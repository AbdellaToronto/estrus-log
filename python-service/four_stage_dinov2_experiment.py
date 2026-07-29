"""Does DINOv2 support a four-stage estrus label on this lab's photographs?

The promoted model (s-biad2395-dinov2-robust-ensemble-20260719-v2) is binary
because the public dataset it was validated on is binary-labelled. This lab's own
photographs carry four-stage labels, so the question is answerable directly: take
the same frozen DINOv2 backbones and robust colour views, fit four-stage heads,
and score them the only way that means anything here — held out by mouse.

Every split is by subject. An image-level split leaks: all 11 mice appear on both
sides of dataset_split_cropped's train/test split, which is why the BioCLIP k-NN
reports 53.3% there and 27.7% when mice are actually held out.

Reference point to beat: BioCLIP + similarity-weighted k-NN reaches 27.7%
balanced accuracy on this data against a 25% chance rate.

Usage:
    python four_stage_dinov2_experiment.py --extract     # cache features
    python four_stage_dinov2_experiment.py               # fit and score
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from collections import Counter
from pathlib import Path

import numpy as np
import torch
from PIL import Image, ImageOps
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler
from sklearn.svm import SVC
from transformers import AutoImageProcessor, AutoModel

STAGES = ["Proestrus", "Estrus", "Metestrus", "Diestrus"]
BACKBONES = {
    "facebook/dinov2-small": "ed25f3a31f01632728cabb09d1542f84ab7b0056",
    "facebook/dinov2-base": "f9e44c814b77203eaa57a6bdbbd535f21ede1415",
}
# The promoted binary policy's "robust_mean" view set. Averaging a colour view, a
# greyscale view and a darkened view is what made the public model hold up across
# coat colours, so it is the right starting point for a dark-coated colony.
VIEWS = ("rgb", "gray", "dark")


def darken_coat(image: Image.Image, strength: float) -> Image.Image:
    """Mirror of the promoted model's synthetic dark-coat view."""
    rgb = np.asarray(image.convert("RGB"), dtype=np.float32) / 255.0
    luminance = 0.2126 * rgb[..., 0] + 0.7152 * rgb[..., 1] + 0.0722 * rgb[..., 2]
    # Fur is the darker, less saturated region; scale it down without crushing
    # the pink tissue the stage actually lives in.
    maximum = rgb.max(axis=2)
    minimum = rgb.min(axis=2)
    saturation = (maximum - minimum) / np.clip(maximum, 1e-4, None)
    fur = np.clip(1.0 - saturation * 2.2, 0.0, 1.0) * np.clip(1.0 - luminance, 0.0, 1.0)
    factor = 1.0 - strength * fur[..., None]
    return Image.fromarray((np.clip(rgb * factor, 0, 1) * 255).astype(np.uint8))


def render_view(image: Image.Image, name: str) -> Image.Image:
    rgb = image.convert("RGB")
    if name == "rgb":
        return rgb
    if name == "gray":
        return ImageOps.grayscale(rgb).convert("RGB")
    if name == "dark":
        return darken_coat(rgb, 0.72)
    raise ValueError(f"Unknown view: {name}")


def resolve_device() -> torch.device:
    if torch.backends.mps.is_available():
        return torch.device("mps")
    if torch.cuda.is_available():
        return torch.device("cuda")
    return torch.device("cpu")


def collect(roots: list[Path]) -> list[tuple[str, str, Path]]:
    """Return (subject, stage, path). Subject comes from the filename prefix."""
    found: list[tuple[str, str, Path]] = []
    for root in roots:
        for stage in STAGES:
            folder = root / stage.upper()
            if not folder.is_dir():
                continue
            for path in sorted(folder.iterdir()):
                if path.suffix.lower() not in {".jpg", ".jpeg", ".png", ".webp"}:
                    continue
                match = re.match(r"([A-Za-z]+\d+[A-Za-z]?)", path.name)
                found.append((match.group(1) if match else "unknown", stage, path))
    return found


@torch.no_grad()
def extract(samples: list[tuple[str, str, Path]], cache: Path) -> dict:
    device = resolve_device()
    print(f"Extracting on {device} across {len(samples)} photographs", flush=True)

    store: dict[str, np.ndarray] = {}
    for backbone, revision in BACKBONES.items():
        processor = AutoImageProcessor.from_pretrained(backbone, revision=revision)
        model = AutoModel.from_pretrained(backbone, revision=revision).to(device).eval()
        key = backbone.replace("/", "--")

        per_view: list[np.ndarray] = []
        for view in VIEWS:
            vectors = []
            for index, (_, _, path) in enumerate(samples):
                with Image.open(path) as raw:
                    rendered = render_view(ImageOps.exif_transpose(raw), view)
                inputs = processor(images=rendered, return_tensors="pt").to(device)
                output = model(**inputs).last_hidden_state[:, 0]  # CLS token
                vectors.append(output.float().cpu().numpy()[0])
                if index % 50 == 0:
                    print(f"  {key} {view}: {index}/{len(samples)}", flush=True)
            per_view.append(np.stack(vectors))
            print(f"  {key} {view}: done", flush=True)

        stacked = np.stack(per_view)  # (views, samples, dim)
        store[f"{key}__mean"] = stacked.mean(axis=0)
        store[f"{key}__concat"] = np.concatenate(list(stacked), axis=1)
        del model

    cache.parent.mkdir(parents=True, exist_ok=True)
    np.savez_compressed(
        cache,
        subjects=np.array([s for s, _, _ in samples]),
        stages=np.array([t for _, t, _ in samples]),
        **store,
    )
    print(f"Cached features to {cache}")
    return store


def leave_one_subject_out(
    features: np.ndarray,
    subjects: np.ndarray,
    labels: np.ndarray,
    head: str,
    classes: list[str],
) -> tuple[np.ndarray, float]:
    """Confusion matrix and balanced accuracy, every subject held out in turn."""
    index = {name: position for position, name in enumerate(classes)}
    confusion = np.zeros((len(classes), len(classes)), dtype=int)

    for held in sorted(set(subjects)):
        train = subjects != held
        test = ~train
        if not test.any() or len(set(labels[train])) < 2:
            continue

        scaler = StandardScaler().fit(features[train])
        model = (
            LogisticRegression(max_iter=3000, C=1.0, class_weight="balanced")
            if head == "logistic"
            else SVC(kernel="rbf", C=4.0, gamma="scale", class_weight="balanced")
        )
        model.fit(scaler.transform(features[train]), labels[train])
        predicted = model.predict(scaler.transform(features[test]))

        for truth, guess in zip(labels[test], predicted):
            confusion[index[truth], index[guess]] += 1

    recalls = [
        confusion[i, i] / confusion[i].sum() if confusion[i].sum() else 0.0
        for i in range(len(classes))
    ]
    return confusion, float(np.mean(recalls))


def report(name: str, confusion: np.ndarray, balanced: float, classes: list[str]) -> None:
    total = confusion.sum()
    plain = np.trace(confusion) / total if total else 0.0
    chance = 1.0 / len(classes)
    print(f"\n{name}")
    print(f"  balanced accuracy {balanced:6.1%}   (chance {chance:.1%})")
    print(f"  plain accuracy    {plain:6.1%}")
    print("  recall per class  " + ", ".join(
        f"{c[:3]} {confusion[i, i] / confusion[i].sum():.0%}" if confusion[i].sum() else f"{c[:3]} n/a"
        for i, c in enumerate(classes)
    ))
    header = "".join(f"{c[:4]:>7}" for c in classes)
    print(f"          {header}   (predicted)")
    for i, c in enumerate(classes):
        print(f"  {c:<8}" + "".join(f"{v:>7}" for v in confusion[i]))


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--extract", action="store_true")
    parser.add_argument("--cache", default="work/model-eval/local-four-stage-dinov2.npz")
    parser.add_argument(
        "--dataset",
        action="append",
        default=None,
        help="Roots holding STAGE/ subfolders. Repeat to combine.",
    )
    args = parser.parse_args()

    roots = [Path(d) for d in (args.dataset or [
        "dataset_split_cropped/train",
        "dataset_split_cropped/test",
    ])]
    cache = Path(args.cache)

    if args.extract or not cache.exists():
        samples = collect(roots)
        if not samples:
            print(f"No images found under {roots}", file=sys.stderr)
            return 1
        extract(samples, cache)

    data = np.load(cache, allow_pickle=False)
    subjects = data["subjects"]
    stages = data["stages"]
    print(f"\n{len(stages)} photographs from {len(set(subjects))} mice")
    print(f"class counts {dict(Counter(stages.tolist()))}")
    majority = max(Counter(stages.tolist()).values()) / len(stages)
    print(f"majority-class baseline {majority:.1%}")

    representations = [k for k in data.files if "__" in k]
    results = []

    for representation in sorted(representations):
        for head in ("logistic", "rbf"):
            confusion, balanced = leave_one_subject_out(
                data[representation], subjects, stages, head, STAGES
            )
            results.append((balanced, representation, head, confusion))
            print(f"  {representation:34} {head:9} balanced {balanced:6.1%}", flush=True)

    results.sort(reverse=True, key=lambda r: r[0])
    balanced, representation, head, confusion = results[0]
    report(f"BEST four-stage: {representation} + {head}", confusion, balanced, STAGES)

    print("\n--- collapsed to the promoted model's binary task ---")
    binary = np.array(
        ["PRO_OR_EST" if s in ("Proestrus", "Estrus") else "MET_OR_DIE" for s in stages]
    )
    binary_classes = ["PRO_OR_EST", "MET_OR_DIE"]
    binary_results = []
    for representation in sorted(representations):
        for head in ("logistic", "rbf"):
            confusion_b, balanced_b = leave_one_subject_out(
                data[representation], subjects, binary, head, binary_classes
            )
            binary_results.append((balanced_b, representation, head, confusion_b))
    binary_results.sort(reverse=True, key=lambda r: r[0])
    balanced_b, representation_b, head_b, confusion_b = binary_results[0]
    report(
        f"BEST binary: {representation_b} + {head_b}", confusion_b, balanced_b, binary_classes
    )

    summary = {
        "four_stage_best": {
            "representation": representation,
            "head": head,
            "balanced_accuracy": balanced,
            "bioclip_knn_reference": 0.277,
            "chance": 0.25,
        },
        "binary_best": {
            "representation": representation_b,
            "head": head_b,
            "balanced_accuracy": balanced_b,
            "chance": 0.5,
        },
        "protocol": "leave-one-mouse-out over local four-stage labelled photographs",
        "photographs": int(len(stages)),
        "mice": int(len(set(subjects))),
    }
    out = cache.with_name("local-four-stage-dinov2-summary.json")
    out.write_text(json.dumps(summary, indent=2))
    print(f"\nWrote {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
