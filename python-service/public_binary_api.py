"""FastAPI wrapper for the guarded public binary ensemble.

Run locally from the repository root:

    uvicorn public_binary_api:app --app-dir python-service --port 8001

The endpoint requires callers to affirm that the uploaded image is an external
genital ROI. It does not accept cytology and never returns a four-stage label.
"""

from __future__ import annotations

import io
import os
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Annotated, Any

from fastapi import FastAPI, File, Form, Header, HTTPException, UploadFile
from PIL import Image, UnidentifiedImageError

from public_binary_inference import PublicBinaryInference


REPOSITORY_ROOT = Path(__file__).resolve().parent.parent
MAX_IMAGE_BYTES = 10 * 1024 * 1024


def _path_from_environment(name: str, fallback: Path) -> Path:
    value = os.environ.get(name)
    return Path(value).expanduser().resolve() if value else fallback.resolve()


def build_predictor() -> PublicBinaryInference:
    return PublicBinaryInference(
        model_dir=_path_from_environment(
            "ESTRUS_BINARY_MODEL_DIR",
            REPOSITORY_ROOT / "work/model-eval/public-confirmatory-20260719",
        ),
        benchmark_dir=_path_from_environment(
            "ESTRUS_BINARY_BENCHMARK_DIR",
            REPOSITORY_ROOT / "work/model-eval/public-foundation-benchmark-20260719",
        ),
        public_data_dir=_path_from_environment(
            "ESTRUS_BINARY_PUBLIC_DATA_DIR",
            REPOSITORY_ROOT / "work/model-eval/public/S-BIAD2395/estrus images",
        ),
        policy_path=_path_from_environment(
            "ESTRUS_BINARY_POLICY_PATH",
            REPOSITORY_ROOT
            / "python-service/model-policies/s-biad2395-dinov2-robust-ensemble-v2.json",
        ),
        device=os.environ.get("ESTRUS_BINARY_DEVICE", "auto"),
    )


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.predictor = build_predictor()
    yield


app = FastAPI(
    title="Estrus external-photo binary research service",
    version="2026.07.19",
    lifespan=lifespan,
)


def _authorize(authorization: str | None) -> None:
    token = os.environ.get("ESTRUS_BINARY_API_TOKEN")
    if not token:
        return
    if authorization != f"Bearer {token}":
        raise HTTPException(status_code=401, detail="Invalid research-model token")


@app.get("/health")
def health() -> dict[str, Any]:
    predictor: PublicBinaryInference = app.state.predictor
    return {
        "status": "ready",
        "task": "external_photo_binary_estrus_group",
        "model_version": predictor.model_version,
        "system": predictor.system_name,
        "threshold": predictor.threshold,
        "review_required": True,
        "roi_required": True,
        "cytology_input": False,
        "four_stage_output": False,
    }


@app.post("/classify-external-binary")
async def classify_external_binary(
    file: Annotated[UploadFile, File(...)],
    roi_confirmed: Annotated[bool, Form(...)],
    modality: Annotated[str, Form()] = "external_photo",
    authorization: Annotated[str | None, Header()] = None,
) -> dict[str, Any]:
    _authorize(authorization)
    if modality != "external_photo":
        raise HTTPException(
            status_code=400,
            detail="This model accepts external genital photographs only, not cytology.",
        )
    if not roi_confirmed:
        raise HTTPException(
            status_code=422,
            detail=(
                "A scientist or validated cropper must confirm the external-genital ROI "
                "before this research model can run."
            ),
        )
    if file.content_type and not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Upload an image file")

    payload = await file.read(MAX_IMAGE_BYTES + 1)
    if not payload or len(payload) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=400, detail="Image must be between 1 byte and 10 MB")
    try:
        with Image.open(io.BytesIO(payload)) as opened:
            image = opened.copy()
    except (UnidentifiedImageError, OSError) as error:
        raise HTTPException(status_code=400, detail="The upload is not a readable image") from error

    predictor: PublicBinaryInference = app.state.predictor
    return predictor.predict_image(image)
