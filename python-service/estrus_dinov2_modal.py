"""Modal service for the DINOv2 estrus classifier.

Deployed alongside the existing BioCLIP and SAM3 endpoints so the Vercel app can
call it the same way. Vercel Functions cannot host this directly — torch plus two
DINOv2 backbones is around a gigabyte, far past the function bundle limit — so
the GPU work lives here and the Next.js route makes an HTTP call.

Two endpoints:

  /features  frozen DINOv2-small and DINOv2-base CLS features under the robust
             colour views, for fitting or evaluating heads offline.
  /classify  the full prediction, applying whichever fitted heads are baked into
             the image at build time.

Deploy with:
    modal deploy python-service/estrus_dinov2_modal.py

Then point the app at the printed URL:
    ESTRUS_DINOV2_API_URL=https://<workspace>--estrus-dinov2-classify.modal.run
"""

from __future__ import annotations

import base64
import io
import json
import os

import modal

APP_NAME = "estrus-dinov2"

# Pinned to the revisions recorded in the promoted policy so served features are
# identical to the ones the heads were fitted on.
BACKBONE_REVISIONS = {
    "facebook/dinov2-small": "ed25f3a31f01632728cabb09d1542f84ab7b0056",
    "facebook/dinov2-base": "f9e44c814b77203eaa57a6bdbbd535f21ede1415",
}
VIEWS = ("rgb", "gray", "dark")

image = (
    modal.Image.debian_slim(python_version="3.12")
    .pip_install(
        "torch==2.8.0",
        "torchvision==0.23.0",
        "transformers==4.57.1",
        "scikit-learn==1.7.2",
        "joblib==1.5.2",
        "pillow==11.3.0",
        "numpy==2.3.4",
    )
    # Bake the backbones into the image so a cold start does not also pay for a
    # Hugging Face download.
    .run_commands(
        "python -c \"from transformers import AutoImageProcessor, AutoModel; "
        + "; ".join(
            f"AutoImageProcessor.from_pretrained('{name}', revision='{revision}'), "
            f"AutoModel.from_pretrained('{name}', revision='{revision}')"
            for name, revision in BACKBONE_REVISIONS.items()
        )
        + '"'
    )
    .add_local_dir("model-artifacts", "/model-artifacts", copy=True)
)

app = modal.App(APP_NAME, image=image)


def _darken_coat(pil_image, strength: float):
    """Mirror of the promoted binary policy's synthetic dark-coat view."""
    import numpy as np
    from PIL import Image

    rgb = np.asarray(pil_image.convert("RGB"), dtype=np.float32) / 255.0
    luminance = 0.2126 * rgb[..., 0] + 0.7152 * rgb[..., 1] + 0.0722 * rgb[..., 2]
    maximum = rgb.max(axis=2)
    minimum = rgb.min(axis=2)
    saturation = (maximum - minimum) / np.clip(maximum, 1e-4, None)
    fur = np.clip(1.0 - saturation * 2.2, 0.0, 1.0) * np.clip(1.0 - luminance, 0.0, 1.0)
    factor = 1.0 - strength * fur[..., None]
    return Image.fromarray((np.clip(rgb * factor, 0, 1) * 255).astype(np.uint8))


def _render(pil_image, view: str):
    from PIL import ImageOps

    rgb = pil_image.convert("RGB")
    if view == "rgb":
        return rgb
    if view == "gray":
        return ImageOps.grayscale(rgb).convert("RGB")
    if view == "dark":
        return _darken_coat(rgb, 0.72)
    raise ValueError(f"Unknown view: {view}")


@app.cls(gpu="T4", image=image, scaledown_window=300, max_containers=4)
class Encoder:
    @modal.enter()
    def load(self):
        import torch
        from transformers import AutoImageProcessor, AutoModel

        self.torch = torch
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.backbones = {}
        for name, revision in BACKBONE_REVISIONS.items():
            processor = AutoImageProcessor.from_pretrained(name, revision=revision)
            model = AutoModel.from_pretrained(name, revision=revision)
            self.backbones[name] = (processor, model.to(self.device).eval())

        # Optional fitted heads, baked in under model-artifacts/.
        self.heads = {}
        artifacts = "/model-artifacts"
        if os.path.isdir(artifacts):
            import joblib

            for entry in sorted(os.listdir(artifacts)):
                if entry.endswith(".joblib"):
                    self.heads[entry[: -len(".joblib")]] = joblib.load(
                        os.path.join(artifacts, entry)
                    )
            manifest = os.path.join(artifacts, "manifest.json")
            self.manifest = (
                json.load(open(manifest)) if os.path.isfile(manifest) else {}
            )
        else:
            self.manifest = {}

    def _embed(self, pil_image):
        """Returns {backbone: {"mean": [...], "concat": [...]}}."""
        import numpy as np

        result = {}
        with self.torch.no_grad():
            for name, (processor, model) in self.backbones.items():
                per_view = []
                for view in VIEWS:
                    rendered = _render(pil_image, view)
                    inputs = processor(images=rendered, return_tensors="pt").to(
                        self.device
                    )
                    cls = model(**inputs).last_hidden_state[:, 0]
                    per_view.append(cls.float().cpu().numpy()[0])
                stacked = np.stack(per_view)
                result[name] = {
                    "mean": stacked.mean(axis=0).tolist(),
                    "concat": np.concatenate(list(stacked)).tolist(),
                }
        return result

    @modal.method()
    def features(self, image_b64: str):
        from PIL import Image, ImageOps

        pil = ImageOps.exif_transpose(Image.open(io.BytesIO(base64.b64decode(image_b64))))
        return {"views": list(VIEWS), "features": self._embed(pil)}

    @modal.method()
    def classify(self, image_b64: str):
        import numpy as np
        from PIL import Image, ImageOps

        pil = ImageOps.exif_transpose(Image.open(io.BytesIO(base64.b64decode(image_b64))))
        embeddings = self._embed(pil)

        if not self.heads:
            return {
                "error": "No fitted head is baked into this image.",
                "features": embeddings,
            }

        # Average calibrated probabilities across every baked-in head whose
        # expected representation is present.
        probabilities = []
        classes = None
        for name, head in self.heads.items():
            backbone, representation = self.manifest.get("heads", {}).get(
                name, {}
            ).get("backbone"), self.manifest.get("heads", {}).get(name, {}).get(
                "representation"
            )
            if not backbone or backbone not in embeddings:
                continue
            vector = np.asarray(
                embeddings[backbone][representation or "mean"], dtype=np.float64
            ).reshape(1, -1)
            if hasattr(head, "predict_proba"):
                probabilities.append(head.predict_proba(vector)[0])
                classes = list(head.classes_)

        if not probabilities or classes is None:
            return {"error": "No baked-in head matched the served representations."}

        mean = np.mean(probabilities, axis=0)
        order = np.argsort(mean)[::-1]
        return {
            "model_version": self.manifest.get("model_version", "unversioned"),
            "task": self.manifest.get("task", "four_stage_external_photo"),
            "scores": {classes[i]: float(mean[i]) for i in order},
            "predicted": classes[int(order[0])],
            "margin": float(mean[order[0]] - mean[order[1]]) if len(order) > 1 else 1.0,
            "heads": len(probabilities),
            "review_required": True,
        }


@app.function(image=image)
@modal.fastapi_endpoint(method="POST", label="estrus-dinov2-features")
def features_endpoint(payload: dict):
    image_b64 = payload.get("image")
    if not image_b64:
        return {"error": "Provide a base64 image under 'image'."}
    return Encoder().features.remote(image_b64)


@app.function(image=image)
@modal.fastapi_endpoint(method="POST", label="estrus-dinov2-classify")
def classify_endpoint(payload: dict):
    image_b64 = payload.get("image")
    if not image_b64:
        return {"error": "Provide a base64 image under 'image'."}
    return Encoder().classify.remote(image_b64)
