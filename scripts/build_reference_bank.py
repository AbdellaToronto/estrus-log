#!/usr/bin/env python3
"""Build the bundled BioCLIP reference bank used by the offline classifier.

Every labelled training image is pushed through the deployed BioCLIP embedding
endpoint, then the resulting 512-d vectors are int8-quantised and written to
src/lib/reference-bank.json.

Quantisation is per-vector (each vector is scaled so its largest magnitude
component lands on 127). Cosine similarity is scale-invariant, so this costs
accuracy only through rounding while cutting the bundle from ~700 KB of JSON
floats to ~120 KB of base64.

Usage:
    python3 scripts/build_reference_bank.py [--dataset DIR] [--out FILE]
"""

from __future__ import annotations

import argparse
import base64
import io
import json
import os
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib import request

from PIL import Image

DEFAULT_ENDPOINT = "https://abdellaalioncan--estrus-pipeline-embed-endpoint.modal.run"
STAGES = ["PROESTRUS", "ESTRUS", "METESTRUS", "DIESTRUS"]
TITLE_CASE = {s: s.capitalize() for s in STAGES}
# BioCLIP resizes to 224x224 internally; 512px keeps the upload small without
# throwing away detail the preprocessing would have used.
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
        except Exception as error:  # noqa: BLE001 - endpoint cold starts are flaky
            if attempt == retries - 1:
                print(f"  ! {path.name}: {error!r}", file=sys.stderr)
                return None
            time.sleep(2 * (attempt + 1))
    return None


def quantise(vector: list[float]) -> bytes:
    peak = max(abs(component) for component in vector)
    if peak == 0:
        return bytes(len(vector))
    scale = 127.0 / peak
    # Signed bytes, two's complement, so -1 stores as 255.
    return bytes(
        max(-127, min(127, round(component * scale))) & 0xFF for component in vector
    )


def main() -> int:
    parser = argparse.ArgumentParser()
    # Repeatable. The lab shoots whole-animal photographs while the public
    # benchmark ships tight ROI crops; those are different visual domains, and
    # the bank needs both or a query from the missing domain matches nothing.
    parser.add_argument(
        "--dataset",
        action="append",
        default=None,
        help="Directory of STAGE/ subfolders. Repeat to combine domains.",
    )
    parser.add_argument("--out", default="src/lib/reference-bank.json")
    parser.add_argument("--endpoint", default=os.environ.get("BIOCLIP_API_URL", DEFAULT_ENDPOINT))
    parser.add_argument("--workers", type=int, default=8)
    args = parser.parse_args()

    datasets = [Path(d) for d in (args.dataset or ["dataset_split_cropped/train"])]
    missing_dirs = [d for d in datasets if not d.is_dir()]
    if missing_dirs:
        print(f"Dataset directories not found: {missing_dirs}", file=sys.stderr)
        return 1

    jobs: list[tuple[str, Path]] = []
    for dataset in datasets:
        for stage in STAGES:
            folder = dataset / stage
            if not folder.is_dir():
                continue
            for image_path in sorted(folder.iterdir()):
                if image_path.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp"}:
                    jobs.append((stage, image_path))

    if not jobs:
        print(f"No images found under {datasets}", file=sys.stderr)
        return 1

    print(f"Embedding {len(jobs)} images via {args.endpoint} ...")
    started = time.time()

    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        vectors = list(pool.map(lambda job: embed(args.endpoint, job[1]), jobs))

    labels: list[str] = []
    blobs: list[bytes] = []
    for (stage, path), vector in zip(jobs, vectors):
        if vector is None:
            continue
        if len(vector) != 512:
            print(f"  ! {path.name}: unexpected dimension {len(vector)}", file=sys.stderr)
            continue
        labels.append(TITLE_CASE[stage])
        blobs.append(quantise(vector))

    if not blobs:
        print("Every embedding failed; refusing to write an empty bank.", file=sys.stderr)
        return 1

    bank = {
        "version": 1,
        "encoder": "BioCLIP",
        "dimensions": 512,
        "quantisation": "int8-per-vector",
        "source": [str(d) for d in datasets],
        "count": len(blobs),
        "labels": labels,
        "vectors": base64.b64encode(b"".join(blobs)).decode(),
    }

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(bank), encoding="utf-8")

    counts: dict[str, int] = {}
    for label in labels:
        counts[label] = counts.get(label, 0) + 1

    elapsed = time.time() - started
    size_kb = out_path.stat().st_size / 1024
    print(f"Wrote {out_path} ({size_kb:.0f} KB) in {elapsed:.0f}s")
    print(f"  {len(blobs)}/{len(jobs)} embedded: " + ", ".join(f"{k} {v}" for k, v in counts.items()))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
