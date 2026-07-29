#!/usr/bin/env python3
"""Score the bundled reference bank against the held-out test split.

Mirrors the similarity-weighted vote in src/lib/server/reference-classifier.ts
so the temperature and abstention thresholds can be tuned against real numbers
instead of guessed. Reports accuracy with and without abstentions, plus a
per-stage confusion matrix.

Usage:
    python3 scripts/evaluate_reference_bank.py [--temperature 0.04] [--k 15]
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
STAGES = ["Proestrus", "Estrus", "Metestrus", "Diestrus"]
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
        except Exception:  # noqa: BLE001
            if attempt == retries - 1:
                return None
            time.sleep(2 * (attempt + 1))
    return None


def load_bank(path: Path) -> tuple[list[str], list[list[float]]]:
    bank = json.loads(path.read_text())
    dimensions = bank["dimensions"]
    raw = base64.b64decode(bank["vectors"])
    labels = bank["labels"]

    vectors: list[list[float]] = []
    for row in range(len(labels)):
        offset = row * dimensions
        values = [
            byte - 256 if byte > 127 else byte
            for byte in raw[offset : offset + dimensions]
        ]
        norm = math.sqrt(sum(v * v for v in values)) or 1.0
        vectors.append([v / norm for v in values])
    return labels, vectors


def unit(vector: list[float]) -> list[float]:
    norm = math.sqrt(sum(v * v for v in vector)) or 1.0
    return [v / norm for v in vector]


def classify(
    embedding: list[float],
    labels: list[str],
    vectors: list[list[float]],
    k: int,
    temperature: float,
) -> tuple[str, dict[str, float], float]:
    query = unit(embedding)
    sims = sorted(
        (
            (sum(q * v for q, v in zip(query, vector)), label)
            for label, vector in zip(labels, vectors)
        ),
        reverse=True,
    )[:k]

    best = sims[0][0]
    scores = {stage: 0.0 for stage in STAGES}
    total = 0.0
    for similarity, label in sims:
        weight = math.exp((similarity - best) / temperature)
        scores[label] = scores.get(label, 0.0) + weight
        total += weight
    if total:
        for stage in scores:
            scores[stage] /= total

    ranked = sorted(STAGES, key=lambda s: scores[s], reverse=True)
    margin = scores[ranked[0]] - scores[ranked[1]]
    return ranked[0], scores, margin


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dataset", default="dataset_split_cropped/test")
    parser.add_argument("--bank", default="src/lib/reference-bank.json")
    parser.add_argument("--cache", default="work/model-eval/test-embeddings.json")
    parser.add_argument("--endpoint", default=os.environ.get("BIOCLIP_API_URL", DEFAULT_ENDPOINT))
    parser.add_argument("--k", type=int, default=15)
    parser.add_argument("--temperature", type=float, default=0.04)
    parser.add_argument("--abstain-below", type=float, default=0.45)
    parser.add_argument("--narrow-margin", type=float, default=0.15)
    parser.add_argument("--sweep", action="store_true", help="Try a grid of k and temperature")
    args = parser.parse_args()

    bank_path = Path(args.bank)
    if not bank_path.is_file():
        print(f"Reference bank not found: {bank_path}", file=sys.stderr)
        return 1
    labels, vectors = load_bank(bank_path)

    cache_path = Path(args.cache)
    cached: dict[str, list[float]] = {}
    if cache_path.is_file():
        cached = json.loads(cache_path.read_text())

    jobs: list[tuple[str, Path]] = []
    dataset = Path(args.dataset)
    for stage in STAGES:
        folder = dataset / stage.upper()
        if not folder.is_dir():
            continue
        for image_path in sorted(folder.iterdir()):
            if image_path.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp"}:
                jobs.append((stage, image_path))

    if not jobs:
        print(f"No test images under {dataset}", file=sys.stderr)
        return 1

    missing = [job for job in jobs if str(job[1]) not in cached]
    if missing:
        print(f"Embedding {len(missing)} test images ...")
        with ThreadPoolExecutor(max_workers=8) as pool:
            results = list(pool.map(lambda job: embed(args.endpoint, job[1]), missing))
        for (_, path), vector in zip(missing, results):
            if vector:
                cached[str(path)] = vector
        cache_path.parent.mkdir(parents=True, exist_ok=True)
        cache_path.write_text(json.dumps(cached))

    samples = [(stage, cached[str(path)]) for stage, path in jobs if str(path) in cached]
    print(f"Scoring {len(samples)} test images against {len(labels)} references.\n")

    grid = (
        [(k, t) for k in (5, 10, 15, 25) for t in (0.02, 0.04, 0.08, 0.15)]
        if args.sweep
        else [(args.k, args.temperature)]
    )

    for k, temperature in grid:
        correct = 0
        confident_correct = 0
        confident_total = 0
        confusion = {truth: {pred: 0 for pred in STAGES} for truth in STAGES}

        for truth, embedding in samples:
            prediction, scores, margin = classify(embedding, labels, vectors, k, temperature)
            confusion[truth][prediction] += 1
            hit = prediction == truth
            correct += hit
            abstained = scores[prediction] < args.abstain_below or margin < args.narrow_margin
            if not abstained:
                confident_total += 1
                confident_correct += hit

        overall = correct / len(samples)
        auto = confident_correct / confident_total if confident_total else 0.0
        coverage = confident_total / len(samples)
        print(
            f"k={k:<3} T={temperature:<5} "
            f"accuracy {overall:6.1%}   "
            f"auto-accept {auto:6.1%} at {coverage:5.1%} coverage"
        )

        if not args.sweep:
            print("\n           " + "".join(f"{s[:4]:>7}" for s in STAGES) + "   (predicted)")
            for truth in STAGES:
                row = "".join(f"{confusion[truth][pred]:>7}" for pred in STAGES)
                print(f"  {truth:<9}{row}")
            print("  (rows are ground truth)")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
