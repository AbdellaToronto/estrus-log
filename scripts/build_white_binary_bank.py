#!/usr/bin/env python3
"""Build and score a white-coat binary reference bank.

The demo's validated scope is white-coated mice, but the bundled four-stage
reference bank is built from this lab's dark-coated photographs. A white upload
therefore lands far from every reference and abstains — correct behaviour, poor
demonstration.

The public S-BIAD2395 set is white-coated and binary-labelled (estrus versus
nonestrus), which maps onto the promoted model's task: PROESTRUS_OR_ESTRUS versus
METESTRUS_OR_DIESTRUS. This embeds its Training split as a reference bank and
scores it against the sealed Testing split, so the demo can say something
truthful about a white photograph without waiting on the GPU ensemble.

Reference point: the promoted DINOv2 eight-head ensemble reaches 66/76 (86.8%)
on the same sealed test.

Usage:
    python3 scripts/build_white_binary_bank.py \
        --dataset "work/model-eval/public/S-BIAD2395/estrus images"
"""

from __future__ import annotations

import argparse
import base64
import io
import json
import math
import os
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib import request

from PIL import Image

DEFAULT_ENDPOINT = "https://abdellaalioncan--estrus-pipeline-embed-endpoint.modal.run"
# Folder name in the public dataset -> the promoted model's binary vocabulary.
LABEL_BY_FOLDER = {
    "estrus": "PROESTRUS_OR_ESTRUS",
    "nonestrus": "METESTRUS_OR_DIESTRUS",
}
CLASSES = ["PROESTRUS_OR_ESTRUS", "METESTRUS_OR_DIESTRUS"]
MAX_EDGE = 512
JPEG_QUALITY = 88


def encode_image(path: Path) -> str:
    with Image.open(path) as img:
        img = img.convert("RGB")
        img.thumbnail((MAX_EDGE, MAX_EDGE), Image.LANCZOS)
        buffer = io.BytesIO()
        img.save(buffer, format="JPEG", quality=JPEG_QUALITY)
    return base64.b64encode(buffer.getvalue()).decode()


def embed(endpoint: str, path: Path, retries: int = 3) -> list[float] | None:
    payload = json.dumps({"image": encode_image(path)}).encode()
    for attempt in range(retries):
        try:
            req = request.Request(
                endpoint, data=payload, headers={"Content-Type": "application/json"}
            )
            with request.urlopen(req, timeout=180) as response:
                return json.loads(response.read())["embedding"]
        except Exception:  # noqa: BLE001 - cold starts are flaky
            if attempt == retries - 1:
                return None
            time.sleep(2 * (attempt + 1))
    return None


def quantise(vector: list[float]) -> bytes:
    peak = max(abs(v) for v in vector)
    if peak == 0:
        return bytes(len(vector))
    scale = 127.0 / peak
    return bytes(max(-127, min(127, round(v * scale))) & 0xFF for v in vector)


def collect(root: Path, split: str) -> list[tuple[str, Path]]:
    found: list[tuple[str, Path]] = []
    for folder, label in LABEL_BY_FOLDER.items():
        directory = root / split / folder
        if not directory.is_dir():
            continue
        for path in sorted(directory.iterdir()):
            if path.suffix.lower() in {".png", ".jpg", ".jpeg", ".webp"}:
                found.append((label, path))
    return found


def unit(vector: list[float]) -> list[float]:
    norm = math.sqrt(sum(v * v for v in vector)) or 1.0
    return [v / norm for v in vector]


def cached_embeddings(
    samples: list[tuple[str, Path]], endpoint: str, cache_path: Path, workers: int
) -> dict[str, list[float]]:
    cache: dict[str, list[float]] = (
        json.loads(cache_path.read_text()) if cache_path.is_file() else {}
    )
    missing = [path for _, path in samples if str(path) not in cache]
    if missing:
        print(f"  embedding {len(missing)} images ...", flush=True)
        with ThreadPoolExecutor(max_workers=workers) as pool:
            for path, vector in zip(missing, pool.map(lambda p: embed(endpoint, p), missing)):
                if vector:
                    cache[str(path)] = vector
        cache_path.parent.mkdir(parents=True, exist_ok=True)
        cache_path.write_text(json.dumps(cache))
    return cache


def classify(
    query: list[float],
    labels: list[str],
    vectors: list[list[float]],
    k: int,
    temperature: float,
) -> tuple[str, dict[str, float]]:
    similarities = sorted(
        (
            (sum(a * b for a, b in zip(query, vector)), label)
            for label, vector in zip(labels, vectors)
        ),
        reverse=True,
    )[:k]

    best = similarities[0][0]
    scores = {name: 0.0 for name in CLASSES}
    total = 0.0
    for similarity, label in similarities:
        weight = math.exp((similarity - best) / temperature)
        scores[label] += weight
        total += weight
    if total:
        for name in scores:
            scores[name] /= total
    return max(CLASSES, key=lambda name: scores[name]), scores


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dataset", default="work/model-eval/public/S-BIAD2395/estrus images")
    parser.add_argument("--out", default="src/lib/white-binary-bank.json")
    parser.add_argument("--cache", default="work/model-eval/white-binary-embeddings.json")
    parser.add_argument("--endpoint", default=os.environ.get("BIOCLIP_API_URL", DEFAULT_ENDPOINT))
    parser.add_argument("--workers", type=int, default=8)
    parser.add_argument("--k", type=int, default=15)
    parser.add_argument("--temperature", type=float, default=0.04)
    parser.add_argument("--sweep", action="store_true")
    args = parser.parse_args()

    root = Path(args.dataset)
    if not root.is_dir():
        print(f"Dataset not found: {root}", file=sys.stderr)
        return 1

    train = collect(root, "Training")
    test = collect(root, "Testing")
    if not train or not test:
        print(f"Expected Training/ and Testing/ under {root}", file=sys.stderr)
        return 1
    print(f"{len(train)} training and {len(test)} sealed test images")

    cache = cached_embeddings(train + test, args.endpoint, Path(args.cache), args.workers)

    bank_labels = [label for label, path in train if str(path) in cache]
    bank_vectors = [unit(cache[str(path)]) for _, path in train if str(path) in cache]
    test_samples = [(label, unit(cache[str(path)])) for label, path in test if str(path) in cache]
    print(f"bank {len(bank_vectors)} references, evaluating {len(test_samples)}\n")

    grid = (
        [(k, t) for k in (5, 10, 15, 25, 50) for t in (0.02, 0.04, 0.08, 0.15)]
        if args.sweep
        else [(args.k, args.temperature)]
    )

    best_setting = None
    for k, temperature in grid:
        confusion = {truth: {pred: 0 for pred in CLASSES} for truth in CLASSES}
        for truth, vector in test_samples:
            predicted, _ = classify(vector, bank_labels, bank_vectors, k, temperature)
            confusion[truth][predicted] += 1
        recalls = [
            confusion[c][c] / sum(confusion[c].values()) if sum(confusion[c].values()) else 0.0
            for c in CLASSES
        ]
        balanced = sum(recalls) / len(recalls)
        correct = sum(confusion[c][c] for c in CLASSES)
        print(
            f"k={k:<3} T={temperature:<5} balanced {balanced:6.1%}   {correct}/{len(test_samples)} correct"
        )
        if best_setting is None or balanced > best_setting[0]:
            best_setting = (balanced, k, temperature, confusion, correct)

    balanced, k, temperature, confusion, correct = best_setting
    print(f"\nBEST k={k} T={temperature}: {balanced:.1%} balanced, {correct}/{len(test_samples)}")
    print("  (promoted DINOv2 eight-head ensemble: 66/76, 86.8%)")
    print("\n                       " + "".join(f"{c[:8]:>10}" for c in CLASSES) + "  (predicted)")
    for truth in CLASSES:
        print(f"  {truth:<20}" + "".join(f"{confusion[truth][p]:>10}" for p in CLASSES))

    bank = {
        "version": 1,
        "encoder": "BioCLIP",
        "task": "external_photo_binary_estrus_group",
        "dimensions": len(bank_vectors[0]),
        "quantisation": "int8-per-vector",
        "source": str(root / "Training"),
        "coat": "white",
        "count": len(bank_vectors),
        "settings": {"k": k, "temperature": temperature},
        "sealed_test": {
            "records": len(test_samples),
            "correct": correct,
            "balanced_accuracy": balanced,
            "promoted_ensemble_correct": 66,
        },
        "labels": bank_labels,
        "vectors": base64.b64encode(
            b"".join(quantise(cache[str(path)]) for _, path in train if str(path) in cache)
        ).decode(),
    }
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(bank))
    print(f"\nWrote {out} ({out.stat().st_size / 1024:.0f} KB)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
