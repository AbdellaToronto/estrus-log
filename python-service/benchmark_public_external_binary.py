"""Reproduce and improve the S-BIAD2395 external-photo binary benchmark.

This runner deliberately keeps the official 682/76 split intact. Candidate
representations and classifier hyperparameters are selected with training-only
cross-validation; the official test labels are used only for the final score
table. The public archive has no mouse identifiers, so subject independence
cannot be verified.

The colour-robust candidates combine RGB, grayscale, and a deterministic
dark-coat simulation. The simulation darkens the fur surrounding a soft central
ellipse while preserving the perivaginal region. It is a stress test and an
augmentation proxy, not a substitute for a real dark-coat test cohort.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import platform
import random
import warnings
from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable, Iterable, Sequence

import joblib
import numpy as np
import sklearn
import torch
from PIL import Image, ImageOps
from sklearn.base import BaseEstimator
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    balanced_accuracy_score,
    confusion_matrix,
    f1_score,
    log_loss,
    precision_recall_fscore_support,
    roc_auc_score,
)
from sklearn.model_selection import GridSearchCV, StratifiedGroupKFold
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.svm import SVC
from transformers import AutoImageProcessor, AutoModel


warnings.filterwarnings(
    "ignore",
    message="The `probability` parameter was deprecated in 1.9.*",
    category=FutureWarning,
)


POSITIVE_STAGES = {"PROESTRUS", "ESTRUS"}
NEGATIVE = "METESTRUS_OR_DIESTRUS"
POSITIVE = "PROESTRUS_OR_ESTRUS"
PAPER_CORRECT = 63
PAPER_TEST_RECORDS = 76
PAPER_ACCURACY = PAPER_CORRECT / PAPER_TEST_RECORDS
PAPER_ROC_AUC = 0.90


@dataclass(frozen=True)
class Sample:
    path: Path
    relative_path: str
    split: str
    stage: str
    target: int
    sha256: str


@dataclass(frozen=True)
class Representation:
    name: str
    clean_views: tuple[str, ...]
    stress_views: tuple[str, ...]
    combine: str


REPRESENTATIONS = (
    Representation("rgb", ("rgb",), ("dark",), "mean"),
    Representation("gray", ("gray",), ("dark_gray",), "mean"),
    Representation(
        "rgb_gray_mean", ("rgb", "gray"), ("dark", "dark_gray"), "mean"
    ),
    Representation(
        "rgb_gray_concat", ("rgb", "gray"), ("dark", "dark_gray"), "concat"
    ),
    Representation(
        "robust_mean",
        ("rgb", "gray", "dark"),
        ("dark", "dark_gray", "dark_more"),
        "mean",
    ),
    Representation(
        "robust_concat",
        ("rgb", "gray", "dark"),
        ("dark", "dark_gray", "dark_more"),
        "concat",
    ),
    Representation(
        "morphology_mean",
        ("gray", "autocontrast"),
        ("dark_gray", "dark_autocontrast"),
        "mean",
    ),
    Representation(
        "coat_neutral_mean",
        ("coat_neutral_rgb", "coat_neutral_gray", "coat_neutral_autocontrast"),
        (
            "dark_coat_neutral_rgb",
            "dark_coat_neutral_gray",
            "dark_coat_neutral_autocontrast",
        ),
        "mean",
    ),
    Representation(
        "coat_neutral_concat",
        ("coat_neutral_rgb", "coat_neutral_gray", "coat_neutral_autocontrast"),
        (
            "dark_coat_neutral_rgb",
            "dark_coat_neutral_gray",
            "dark_coat_neutral_autocontrast",
        ),
        "concat",
    ),
    Representation(
        "roi80_mean",
        ("roi80_rgb", "roi80_gray", "roi80_dark"),
        ("roi80_dark", "roi80_dark_gray", "roi80_dark_more"),
        "mean",
    ),
    Representation(
        "roi80_concat",
        ("roi80_rgb", "roi80_gray", "roi80_dark"),
        ("roi80_dark", "roi80_dark_gray", "roi80_dark_more"),
        "concat",
    ),
    Representation(
        "roi65_mean",
        ("roi65_rgb", "roi65_gray", "roi65_dark"),
        ("roi65_dark", "roi65_dark_gray", "roi65_dark_more"),
        "mean",
    ),
    Representation(
        "roi65_concat",
        ("roi65_rgb", "roi65_gray", "roi65_dark"),
        ("roi65_dark", "roi65_dark_gray", "roi65_dark_more"),
        "concat",
    ),
    Representation(
        "multiscale_mean",
        (
            "rgb",
            "gray",
            "dark",
            "roi80_rgb",
            "roi80_gray",
            "roi80_dark",
            "roi65_rgb",
            "roi65_gray",
            "roi65_dark",
        ),
        (
            "dark",
            "dark_gray",
            "dark_more",
            "roi80_dark",
            "roi80_dark_gray",
            "roi80_dark_more",
            "roi65_dark",
            "roi65_dark_gray",
            "roi65_dark_more",
        ),
        "mean",
    ),
    Representation(
        "multiscale_concat",
        (
            "rgb",
            "gray",
            "dark",
            "roi80_rgb",
            "roi80_gray",
            "roi80_dark",
            "roi65_rgb",
            "roi65_gray",
            "roi65_dark",
        ),
        (
            "dark",
            "dark_gray",
            "dark_more",
            "roi80_dark",
            "roi80_dark_gray",
            "roi80_dark_more",
            "roi65_dark",
            "roi65_dark_gray",
            "roi65_dark_more",
        ),
        "concat",
    ),
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Training-only-selected frozen-feature benchmark on S-BIAD2395"
    )
    parser.add_argument("--data", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument(
        "--backbones",
        nargs="+",
        default=("facebook/dinov2-small", "facebook/dinov2-base"),
    )
    parser.add_argument(
        "--representations",
        nargs="+",
        choices=tuple(value.name for value in REPRESENTATIONS),
        help="Evaluate only this predeclared representation subset.",
    )
    parser.add_argument("--batch-size", type=int, default=32)
    parser.add_argument("--seed", type=int, default=20260719)
    parser.add_argument("--folds", type=int, default=5)
    parser.add_argument(
        "--device", choices=("auto", "mps", "cuda", "cpu"), default="auto"
    )
    parser.add_argument(
        "--reuse-features",
        action=argparse.BooleanOptionalAction,
        default=True,
        help="Reuse cached feature arrays when the sample manifest matches.",
    )
    return parser.parse_args()


def seed_everything(seed: int) -> None:
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)


def resolve_device(requested: str) -> torch.device:
    if requested == "auto":
        if torch.backends.mps.is_available():
            return torch.device("mps")
        if torch.cuda.is_available():
            return torch.device("cuda")
        return torch.device("cpu")
    return torch.device(requested)


def load_samples(root: Path) -> list[Sample]:
    root = root.resolve()
    samples: list[Sample] = []
    stage_names = ("PROESTRUS", "ESTRUS", "METESTRUS", "DIESTRUS")
    for path in sorted(root.rglob("*.png")):
        split = (
            "train"
            if "Training" in path.parts
            else "test"
            if "Testing" in path.parts
            else None
        )
        stage = next(
            (value for value in stage_names if path.name.upper().startswith(value)),
            None,
        )
        if split is None or stage is None:
            continue
        samples.append(
            Sample(
                path=path.resolve(),
                relative_path=str(path.relative_to(root)),
                split=split,
                stage=stage,
                target=int(stage in POSITIVE_STAGES),
                sha256=hashlib.sha256(path.read_bytes()).hexdigest(),
            )
        )
    if len(samples) != 758:
        raise ValueError(f"Expected 758 released PNGs, found {len(samples)} below {root}")
    train = sum(sample.split == "train" for sample in samples)
    test = sum(sample.split == "test" for sample in samples)
    if (train, test) != (682, 76):
        raise ValueError(f"Expected official 682/76 split, found {train}/{test}")
    return samples


def manifest_digest(samples: Sequence[Sample]) -> str:
    digest = hashlib.sha256()
    for sample in samples:
        digest.update(sample.relative_path.encode("utf-8"))
        digest.update(b"\0")
        digest.update(sample.sha256.encode("ascii"))
        digest.update(b"\0")
    return digest.hexdigest()


def dataset_audit(samples: Sequence[Sample]) -> dict[str, Any]:
    by_hash: dict[str, list[Sample]] = defaultdict(list)
    sizes: Counter[str] = Counter()
    for sample in samples:
        by_hash[sample.sha256].append(sample)
        with Image.open(sample.path) as image:
            sizes[f"{image.width}x{image.height}:{image.mode}"] += 1
    duplicates = [values for values in by_hash.values() if len(values) > 1]
    cross_split = [
        values for values in duplicates if len({sample.split for sample in values}) > 1
    ]
    return {
        "records": len(samples),
        "split_counts": dict(Counter(sample.split for sample in samples)),
        "stage_counts": dict(Counter(sample.stage for sample in samples)),
        "binary_counts": {
            split: dict(
                Counter(
                    POSITIVE if sample.target else NEGATIVE
                    for sample in samples
                    if sample.split == split
                )
            )
            for split in ("train", "test")
        },
        "image_shapes": dict(sizes),
        "exact_duplicate_groups": [
            [sample.relative_path for sample in values] for values in duplicates
        ],
        "cross_split_exact_duplicate_groups": [
            [sample.relative_path for sample in values] for values in cross_split
        ],
        "mouse_identifiers_available": False,
    }


def darken_coat(image: Image.Image, strength: float) -> Image.Image:
    """Darken surrounding fur while softly preserving the central genital ROI."""

    rgb = np.asarray(image.convert("RGB"), dtype=np.float32) / 255.0
    height, width = rgb.shape[:2]
    yy, xx = np.mgrid[0:height, 0:width]
    x = (xx / max(width - 1, 1) - 0.50) / 0.30
    y = (yy / max(height - 1, 1) - 0.55) / 0.40
    radius = np.sqrt(x * x + y * y)
    outside = np.clip((radius - 0.72) / 0.48, 0.0, 1.0)[..., None]
    luminance = (
        0.2126 * rgb[..., 0:1]
        + 0.7152 * rgb[..., 1:2]
        + 0.0722 * rgb[..., 2:3]
    )
    neutral_dark = np.repeat(luminance * (1.0 - strength), 3, axis=2)
    shifted = rgb * (1.0 - outside) + (
        rgb * (1.0 - strength) * 0.35 + neutral_dark * 0.65
    ) * outside
    return Image.fromarray(np.uint8(np.clip(shifted * 255.0, 0, 255)))


def centered_roi(image: Image.Image, fraction: float) -> Image.Image:
    """Crop around the protocol-centred genital region to reduce fur context."""

    if not 0 < fraction <= 1:
        raise ValueError("ROI fraction must be in (0, 1]")
    width, height = image.size
    crop_width = max(1, round(width * fraction))
    crop_height = max(1, round(height * fraction))
    left = max(0, (width - crop_width) // 2)
    top = max(0, (height - crop_height) // 2)
    return image.crop((left, top, left + crop_width, top + crop_height))


def neutralize_coat(image: Image.Image) -> Image.Image:
    """Standardize outer-coat chroma and illumination, preserving the soft ROI."""

    rgb = np.asarray(image.convert("RGB"), dtype=np.float32) / 255.0
    height, width = rgb.shape[:2]
    yy, xx = np.mgrid[0:height, 0:width]
    x = (xx / max(width - 1, 1) - 0.50) / 0.30
    y = (yy / max(height - 1, 1) - 0.55) / 0.40
    radius = np.sqrt(x * x + y * y)
    outside = np.clip((radius - 0.72) / 0.48, 0.0, 1.0)[..., None]
    luminance = (
        0.2126 * rgb[..., 0:1]
        + 0.7152 * rgb[..., 1:2]
        + 0.0722 * rgb[..., 2:3]
    )
    outer_values = luminance[outside[..., 0] > 0.5]
    location = float(np.median(outer_values)) if outer_values.size else float(np.median(luminance))
    scale = float(np.median(np.abs(outer_values - location))) if outer_values.size else 0.0
    standardized = np.clip(0.46 + 0.10 * (luminance - location) / max(scale * 1.4826, 0.05), 0.20, 0.72)
    neutral = np.repeat(standardized, 3, axis=2)
    shifted = rgb * (1.0 - outside) + neutral * outside
    return Image.fromarray(np.uint8(np.clip(shifted * 255.0, 0, 255)))


def render_view(image: Image.Image, name: str) -> Image.Image:
    rgb = image.convert("RGB")
    for prefix, fraction in (("roi80_", 0.80), ("roi65_", 0.65)):
        if name.startswith(prefix):
            return centered_roi(render_view(rgb, name[len(prefix) :]), fraction)
    if name == "rgb":
        return rgb
    if name == "gray":
        return ImageOps.grayscale(rgb).convert("RGB")
    if name == "autocontrast":
        return ImageOps.autocontrast(ImageOps.grayscale(rgb)).convert("RGB")
    if name == "dark":
        return darken_coat(rgb, 0.72)
    if name == "dark_more":
        return darken_coat(rgb, 0.90)
    if name == "dark_gray":
        return ImageOps.grayscale(darken_coat(rgb, 0.72)).convert("RGB")
    if name == "dark_autocontrast":
        return ImageOps.autocontrast(
            ImageOps.grayscale(darken_coat(rgb, 0.72))
        ).convert("RGB")
    if name == "coat_neutral_rgb":
        return neutralize_coat(rgb)
    if name == "coat_neutral_gray":
        return ImageOps.grayscale(neutralize_coat(rgb)).convert("RGB")
    if name == "coat_neutral_autocontrast":
        return ImageOps.autocontrast(ImageOps.grayscale(neutralize_coat(rgb))).convert("RGB")
    if name == "dark_coat_neutral_rgb":
        return neutralize_coat(darken_coat(rgb, 0.72))
    if name == "dark_coat_neutral_gray":
        return ImageOps.grayscale(neutralize_coat(darken_coat(rgb, 0.72))).convert("RGB")
    if name == "dark_coat_neutral_autocontrast":
        return ImageOps.autocontrast(
            ImageOps.grayscale(neutralize_coat(darken_coat(rgb, 0.72)))
        ).convert("RGB")
    raise ValueError(f"Unknown view: {name}")


def chunked(values: Sequence[Any], size: int) -> Iterable[Sequence[Any]]:
    for start in range(0, len(values), size):
        yield values[start : start + size]


def safe_name(value: str) -> str:
    return value.replace("/", "--").replace("_", "-")


def extract_backbone_features(
    *,
    backbone: str,
    samples: Sequence[Sample],
    views: Sequence[str],
    device: torch.device,
    batch_size: int,
    output_dir: Path,
    digest: str,
    reuse: bool,
) -> dict[str, np.ndarray]:
    cache = output_dir / f"features-{safe_name(backbone)}.npz"
    metadata_path = output_dir / f"features-{safe_name(backbone)}.json"
    if reuse and cache.exists() and metadata_path.exists():
        metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
        if metadata.get("manifest_sha256") == digest and metadata.get("views") == list(
            views
        ):
            print(f"Reusing {cache}", flush=True)
            loaded = np.load(cache)
            return {view: loaded[view] for view in views}

    print(f"Loading frozen backbone {backbone}", flush=True)
    processor = AutoImageProcessor.from_pretrained(backbone)
    model = AutoModel.from_pretrained(backbone).eval().to(device)
    result: dict[str, np.ndarray] = {}
    for view in views:
        vectors: list[np.ndarray] = []
        for batch_number, batch in enumerate(chunked(samples, batch_size), start=1):
            images = []
            for sample in batch:
                with Image.open(sample.path) as image:
                    images.append(render_view(image, view))
            inputs = processor(images=images, return_tensors="pt")
            inputs = {name: value.to(device) for name, value in inputs.items()}
            with torch.inference_mode():
                outputs = model(**inputs)
                features = outputs.pooler_output
                features = torch.nn.functional.normalize(features, p=2, dim=1)
            vectors.append(features.cpu().numpy().astype(np.float32))
            if batch_number % 5 == 0:
                done = min(batch_number * batch_size, len(samples))
                print(f"  {view}: {done}/{len(samples)}", flush=True)
        result[view] = np.concatenate(vectors)
    np.savez_compressed(cache, **result)
    metadata_path.write_text(
        json.dumps(
            {
                "backbone": backbone,
                "manifest_sha256": digest,
                "views": list(views),
                "records": len(samples),
                "feature_dimensions": {
                    name: int(values.shape[1]) for name, values in result.items()
                },
            },
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    del model
    if device.type == "mps":
        torch.mps.empty_cache()
    return result


def combine_features(
    features: dict[str, np.ndarray], views: Sequence[str], method: str
) -> np.ndarray:
    selected = [features[name] for name in views]
    if method == "concat":
        return np.concatenate(selected, axis=1)
    combined = np.mean(np.stack(selected, axis=0), axis=0)
    norms = np.linalg.norm(combined, axis=1, keepdims=True)
    return combined / np.clip(norms, 1e-12, None)


def duplicate_groups(samples: Sequence[Sample]) -> np.ndarray:
    """Keep exact duplicates in the same training CV fold."""

    first: dict[str, int] = {}
    groups: list[int] = []
    for index, sample in enumerate(samples):
        groups.append(first.setdefault(sample.sha256, index))
    return np.asarray(groups)


def candidate_searches(
    folds: int, seed: int, groups: np.ndarray, labels: np.ndarray
) -> list[tuple[str, GridSearchCV]]:
    splitter = StratifiedGroupKFold(n_splits=folds, shuffle=True, random_state=seed)
    splits = list(splitter.split(np.arange(len(labels)), labels, groups))
    scoring = {"balanced_accuracy": "balanced_accuracy", "roc_auc": "roc_auc"}
    logistic = GridSearchCV(
        estimator=Pipeline(
            [
                ("scale", StandardScaler()),
                (
                    "model",
                    LogisticRegression(
                        class_weight="balanced", max_iter=4000, random_state=seed
                    ),
                ),
            ]
        ),
        param_grid={"model__C": [0.001, 0.01, 0.1, 1.0, 10.0, 100.0]},
        scoring=scoring,
        refit="balanced_accuracy",
        cv=splits,
        n_jobs=-1,
        return_train_score=False,
    )
    rbf_svm = GridSearchCV(
        estimator=Pipeline(
            [
                ("scale", StandardScaler()),
                (
                    "model",
                    SVC(
                        kernel="rbf",
                        class_weight="balanced",
                        probability=True,
                        random_state=seed,
                    ),
                ),
            ]
        ),
        param_grid={
            "model__C": [0.1, 1.0, 10.0, 100.0],
            "model__gamma": ["scale", 0.0001, 0.001, 0.01],
        },
        scoring=scoring,
        refit="balanced_accuracy",
        cv=splits,
        n_jobs=-1,
        return_train_score=False,
    )
    return [("logistic", logistic), ("rbf_svm", rbf_svm)]


def clean_parameters(parameters: dict[str, Any]) -> dict[str, Any]:
    return {
        name: value.item() if isinstance(value, np.generic) else value
        for name, value in parameters.items()
    }


def binary_metrics(
    truth: np.ndarray, probability: np.ndarray, threshold: float = 0.5
) -> dict[str, Any]:
    probability = np.clip(np.asarray(probability, dtype=np.float64), 1e-9, 1 - 1e-9)
    predicted = (probability >= threshold).astype(int)
    precision, recall, f1, support = precision_recall_fscore_support(
        truth, predicted, labels=[0, 1], zero_division=0
    )
    return {
        "records": int(len(truth)),
        "threshold": float(threshold),
        "correct": int((predicted == truth).sum()),
        "accuracy": float(accuracy_score(truth, predicted)),
        "balanced_accuracy": float(balanced_accuracy_score(truth, predicted)),
        "macro_f1": float(f1_score(truth, predicted, average="macro")),
        "roc_auc": float(roc_auc_score(truth, probability)),
        "log_loss": float(log_loss(truth, probability, labels=[0, 1])),
        "confusion_matrix": confusion_matrix(truth, predicted, labels=[0, 1]).tolist(),
        "per_class": {
            NEGATIVE: {
                "precision": float(precision[0]),
                "recall": float(recall[0]),
                "f1": float(f1[0]),
                "support": int(support[0]),
            },
            POSITIVE: {
                "precision": float(precision[1]),
                "recall": float(recall[1]),
                "f1": float(f1[1]),
                "support": int(support[1]),
            },
        },
    }


def bootstrap_interval(
    truth: np.ndarray, probability: np.ndarray, seed: int, draws: int = 10000
) -> dict[str, list[float]]:
    """Image bootstrap only; mouse-cluster bootstrap is impossible without IDs."""

    rng = np.random.default_rng(seed)
    values: dict[str, list[float]] = defaultdict(list)
    for _ in range(draws):
        rows = rng.integers(0, len(truth), size=len(truth))
        if len(np.unique(truth[rows])) < 2:
            continue
        summary = binary_metrics(truth[rows], probability[rows])
        for name in ("accuracy", "balanced_accuracy", "macro_f1", "roc_auc"):
            values[name].append(summary[name])
    return {
        name: [float(np.percentile(scores, 2.5)), float(np.percentile(scores, 97.5))]
        for name, scores in values.items()
    }


def probability(estimator: BaseEstimator, features: np.ndarray) -> np.ndarray:
    return np.asarray(estimator.predict_proba(features)[:, 1], dtype=np.float64)


def main() -> None:
    args = parse_args()
    seed_everything(args.seed)
    args.output_dir.mkdir(parents=True, exist_ok=True)
    samples = load_samples(args.data)
    audit = dataset_audit(samples)
    digest = manifest_digest(samples)
    device = resolve_device(args.device)
    representations = tuple(
        value
        for value in REPRESENTATIONS
        if args.representations is None or value.name in args.representations
    )
    views = sorted(
        {
            view
            for representation in representations
            for view in (*representation.clean_views, *representation.stress_views)
        }
    )
    labels = np.asarray([sample.target for sample in samples])
    train = np.asarray(
        [index for index, sample in enumerate(samples) if sample.split == "train"]
    )
    test = np.asarray(
        [index for index, sample in enumerate(samples) if sample.split == "test"]
    )
    train_samples = [samples[int(index)] for index in train]
    cv_groups = duplicate_groups(train_samples)

    candidates: list[dict[str, Any]] = []
    fitted: dict[tuple[str, str, str], tuple[BaseEstimator, np.ndarray, np.ndarray]] = {}
    feature_dimensions: dict[str, dict[str, int]] = {}
    for backbone in args.backbones:
        extracted = extract_backbone_features(
            backbone=backbone,
            samples=samples,
            views=views,
            device=device,
            batch_size=args.batch_size,
            output_dir=args.output_dir,
            digest=digest,
            reuse=args.reuse_features,
        )
        feature_dimensions[backbone] = {
            view: int(values.shape[1]) for view, values in extracted.items()
        }
        for representation in representations:
            clean = combine_features(
                extracted, representation.clean_views, representation.combine
            )
            stress = combine_features(
                extracted, representation.stress_views, representation.combine
            )
            for classifier_name, search in candidate_searches(
                args.folds, args.seed, cv_groups, labels[train]
            ):
                print(
                    f"Selecting {backbone} / {representation.name} / {classifier_name}",
                    flush=True,
                )
                search.fit(clean[train], labels[train], groups=cv_groups)
                best = int(search.best_index_)
                record = {
                    "backbone": backbone,
                    "representation": representation.name,
                    "classifier": classifier_name,
                    "selected_without_official_test_labels": True,
                    "cv_mean_balanced_accuracy": float(
                        search.cv_results_["mean_test_balanced_accuracy"][best]
                    ),
                    "cv_sd_balanced_accuracy": float(
                        search.cv_results_["std_test_balanced_accuracy"][best]
                    ),
                    "cv_mean_roc_auc": float(search.cv_results_["mean_test_roc_auc"][best]),
                    "cv_sd_roc_auc": float(search.cv_results_["std_test_roc_auc"][best]),
                    "best_parameters": clean_parameters(search.best_params_),
                }
                candidates.append(record)
                fitted[(backbone, representation.name, classifier_name)] = (
                    search.best_estimator_,
                    clean,
                    stress,
                )

    candidates.sort(
        key=lambda value: (
            value["cv_mean_balanced_accuracy"], value["cv_mean_roc_auc"]
        ),
        reverse=True,
    )
    selected = candidates[0]
    selected_key = (
        selected["backbone"],
        selected["representation"],
        selected["classifier"],
    )
    estimator, clean, stress = fitted[selected_key]
    clean_probability = probability(estimator, clean[test])
    stress_probability = probability(estimator, stress[test])
    official_metrics = binary_metrics(labels[test], clean_probability)
    official_metrics["image_bootstrap_95pct_ci"] = bootstrap_interval(
        labels[test], clean_probability, args.seed
    )
    stress_metrics = binary_metrics(labels[test], stress_probability)
    selected["official_test_metrics"] = official_metrics
    selected["dark_coat_stress_metrics"] = stress_metrics
    selected["paper_accuracy_difference_percentage_points"] = float(
        100.0 * (official_metrics["accuracy"] - PAPER_ACCURACY)
    )
    selected["paper_correct_difference"] = int(
        official_metrics["correct"] - PAPER_CORRECT
    )

    # Evaluate every training-selected candidate for transparency. These are
    # exploratory comparisons; only the first candidate was selected without
    # consulting official-test labels.
    exploratory: list[dict[str, Any]] = []
    for record in candidates:
        key = (record["backbone"], record["representation"], record["classifier"])
        model, candidate_clean, candidate_stress = fitted[key]
        exploratory.append(
            {
                "backbone": record["backbone"],
                "representation": record["representation"],
                "classifier": record["classifier"],
                "cv_mean_balanced_accuracy": record["cv_mean_balanced_accuracy"],
                "official_test": binary_metrics(
                    labels[test], probability(model, candidate_clean[test])
                ),
                "dark_coat_stress": binary_metrics(
                    labels[test], probability(model, candidate_stress[test])
                ),
            }
        )

    artifact_name = "selected-public-binary-classifier.joblib"
    joblib.dump(estimator, args.output_dir / artifact_name)
    with (args.output_dir / "selected-official-test-predictions.csv").open(
        "w", newline="", encoding="utf-8"
    ) as handle:
        fieldnames = [
            "relative_path",
            "stage",
            "true_binary_label",
            "probability_positive",
            "predicted_binary_label",
            "dark_coat_probability_positive",
            "dark_coat_predicted_binary_label",
        ]
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        for index, clean_value, stress_value in zip(
            test, clean_probability, stress_probability, strict=True
        ):
            sample = samples[int(index)]
            writer.writerow(
                {
                    "relative_path": sample.relative_path,
                    "stage": sample.stage,
                    "true_binary_label": POSITIVE if sample.target else NEGATIVE,
                    "probability_positive": float(clean_value),
                    "predicted_binary_label": POSITIVE if clean_value >= 0.5 else NEGATIVE,
                    "dark_coat_probability_positive": float(stress_value),
                    "dark_coat_predicted_binary_label": POSITIVE
                    if stress_value >= 0.5
                    else NEGATIVE,
                }
            )

    report = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "question": "Can a reproducible external-photo model match or exceed the published RCN result while reducing coat-colour dependence?",
        "scope": "Binary external-genital photographs only; labels are cytology-referenced but cytology images are not inputs.",
        "dataset": {
            "accession": "S-BIAD2395",
            "license": "CC BY 4.0",
            "manifest_sha256": digest,
            "audit": audit,
        },
        "published_comparator": {
            "model": "Repro Cycle Net",
            "correct": PAPER_CORRECT,
            "test_records": PAPER_TEST_RECORDS,
            "accuracy": PAPER_ACCURACY,
            "reported_rounded_accuracy": 0.83,
            "reported_roc_auc": PAPER_ROC_AUC,
            "confusion_matrix": [[29, 9], [4, 34]],
            "test_loss": 0.047,
        },
        "selection_contract": {
            "official_split_preserved": True,
            "candidate_selection_uses_training_partition_only": True,
            "cv_folds": args.folds,
            "exact_duplicate_groups_kept_within_cv_fold": True,
            "selection_metric": "mean cross-validated balanced accuracy, then ROC-AUC",
            "official_test_used_for_final_scoring": True,
            "exploratory_table_reuses_official_test": True,
        },
        "selected_candidate": selected,
        "candidate_cv_results": candidates,
        "exploratory_official_test_results": exploratory,
        "artifacts": {
            "classifier": artifact_name,
            "predictions": "selected-official-test-predictions.csv",
            "feature_dimensions": feature_dimensions,
        },
        "environment": {
            "python": platform.python_version(),
            "platform": platform.platform(),
            "torch": torch.__version__,
            "sklearn": sklearn.__version__,
            "device": str(device),
            "seed": args.seed,
        },
        "limitations": [
            "The archive has no mouse IDs, session IDs, or paired smear files; subject independence and cytology labels cannot be independently audited.",
            "The official test set has only 76 images. One image changes accuracy by 1.32 percentage points.",
            "The exploratory candidate table reuses the official test set and must not be treated as an independent model-selection set.",
            "The deterministic dark-coat transformation is a synthetic stress test, not evidence of performance on real dark-coated mice.",
            "A deployable claim still requires a local cytology-grounded, mouse-held-out test cohort with standardized ROI capture.",
        ],
    }
    report_path = args.output_dir / "benchmark-report.json"
    report_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {report_path}", flush=True)
    print(json.dumps(selected, indent=2), flush=True)


if __name__ == "__main__":
    main()
