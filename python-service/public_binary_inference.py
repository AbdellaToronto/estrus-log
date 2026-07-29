"""Guarded inference for the validated S-BIAD2395 external-photo ensemble.

This module deliberately exposes only the binary task established by the
public benchmark: PROESTRUS_OR_ESTRUS versus METESTRUS_OR_DIESTRUS. It does not
infer a four-stage label and it does not process cytology images.

Each prediction includes:

* the clean colour-robust ensemble probability;
* the same ensemble under the benchmark's synthetic dark-coat views;
* disagreement across the eight frozen-feature classifier heads; and
* nearest-reference similarity to the public training images.

The response is always review-required until a local, cytology-grounded,
mouse/session-held-out validation establishes an operating policy.
"""

from __future__ import annotations

import argparse
import hashlib
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Sequence

import joblib
import numpy as np
import torch
from PIL import Image, ImageOps
from transformers import AutoImageProcessor, AutoModel

from benchmark_public_external_binary import (
    NEGATIVE,
    POSITIVE,
    REPRESENTATIONS,
    combine_features,
    load_samples,
    manifest_digest,
    render_view,
    resolve_device,
    safe_name,
)


COMPONENTS = {
    "small_mean_logistic": ("facebook/dinov2-small", "robust_mean"),
    "small_mean_rbf": ("facebook/dinov2-small", "robust_mean"),
    "base_mean_logistic": ("facebook/dinov2-base", "robust_mean"),
    "base_mean_rbf": ("facebook/dinov2-base", "robust_mean"),
    "small_concat_logistic": ("facebook/dinov2-small", "robust_concat"),
    "small_concat_rbf": ("facebook/dinov2-small", "robust_concat"),
    "base_concat_logistic": ("facebook/dinov2-base", "robust_concat"),
    "base_concat_rbf": ("facebook/dinov2-base", "robust_concat"),
}

INFERENCE_VIEWS = ("rgb", "gray", "dark", "dark_gray", "dark_more")
REFERENCE_QUANTILE = 0.01
STABILITY_QUANTILE = 0.95
ACQUISITION_QUANTILE = 0.01
ACQUISITION_SCORE_QUANTILE = 0.995
DEFAULT_POLICY_PATH = (
    Path(__file__).resolve().parent
    / "model-policies/s-biad2395-dinov2-robust-ensemble-v2.json"
)


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


@dataclass(frozen=True)
class ReferenceProfile:
    features: np.ndarray
    nearest_neighbour_distribution: np.ndarray
    similarity_floor: float


@dataclass(frozen=True)
class AcquisitionProfile:
    reference_ranges: dict[str, tuple[float, float]]
    severe_ranges: dict[str, tuple[float, float]]
    robust_centres: dict[str, float]
    robust_scales: dict[str, float]
    robust_score_limit: float


def _acquisition_metrics(image: Image.Image) -> dict[str, float]:
    rgb = np.asarray(ImageOps.exif_transpose(image).convert("RGB"), dtype=np.float32) / 255.0
    luminance = 0.2126 * rgb[..., 0] + 0.7152 * rgb[..., 1] + 0.0722 * rgb[..., 2]
    maximum = rgb.max(axis=2)
    minimum = rgb.min(axis=2)
    saturation = (maximum - minimum) / np.clip(maximum, 1e-4, None)
    height, width = luminance.shape
    yy, xx = np.mgrid[0:height, 0:width]
    x = (xx / max(width - 1, 1) - 0.50) / 0.30
    y = (yy / max(height - 1, 1) - 0.55) / 0.40
    radius = np.sqrt(x * x + y * y)
    centre = radius <= 0.72
    outer = radius >= 1.0
    channel_mean = rgb.reshape(-1, 3).mean(axis=0)
    centre_luminance = float(np.median(luminance[centre]))
    outer_luminance = float(np.median(luminance[outer]))
    return {
        "median_luminance": float(np.median(luminance)),
        "median_saturation": float(np.median(saturation)),
        "red_green_ratio": float(channel_mean[0] / max(channel_mean[1], 1e-4)),
        "blue_green_ratio": float(channel_mean[2] / max(channel_mean[1], 1e-4)),
        "shadow_fraction": float(np.mean(luminance < 0.10)),
        "highlight_fraction": float(np.mean(luminance > 0.95)),
        "centre_outer_luminance_ratio": float(
            centre_luminance / max(outer_luminance, 1e-4)
        ),
    }


def _normalise_rows(values: np.ndarray) -> np.ndarray:
    norms = np.linalg.norm(values, axis=1, keepdims=True)
    return values / np.clip(norms, 1e-12, None)


def _nearest_reference(values: np.ndarray, reference: np.ndarray) -> np.ndarray:
    return _normalise_rows(values) @ _normalise_rows(reference).T


class PublicBinaryInference:
    """Load the confirmed ensemble and serve bounded external-photo predictions."""

    def __init__(
        self,
        *,
        model_dir: Path,
        benchmark_dir: Path,
        public_data_dir: Path,
        policy_path: Path = DEFAULT_POLICY_PATH,
        device: str = "auto",
    ) -> None:
        self.model_dir = model_dir.resolve()
        self.benchmark_dir = benchmark_dir.resolve()
        self.public_data_dir = public_data_dir.resolve()
        self.device = resolve_device(device)

        report_path = self.model_dir / "confirmatory-report.json"
        self.report = json.loads(report_path.read_text(encoding="utf-8"))
        self.policy = json.loads(policy_path.read_text(encoding="utf-8"))
        expected_report_hash = str(self.policy["base_model_report_sha256"])
        if _sha256(report_path) != expected_report_hash:
            raise ValueError("Model report does not match the promoted decision policy")
        selected = self.report["selected_system"]
        self.system_name = str(selected["system"])
        self.component_names = tuple(selected["components"])
        if self.system_name != self.policy["system"]:
            raise ValueError("Promoted policy system does not match the model report")
        if self.component_names != tuple(self.policy["components"]):
            raise ValueError("Promoted policy components do not match the model report")
        self.threshold = float(self.policy["threshold"])
        self.model_version = str(self.policy["model_version"])
        acquisition_guard = self.policy["acquisition_guard"]
        self.acquisition_tail_quantile = float(acquisition_guard["tail_quantile"])
        if not 0.0 < self.acquisition_tail_quantile < 0.5:
            raise ValueError("Acquisition tail quantile must be between 0 and 0.5")
        unknown = sorted(set(self.component_names) - set(COMPONENTS))
        if unknown:
            raise ValueError(f"Unsupported ensemble components: {unknown}")

        self.public_samples = load_samples(self.public_data_dir)
        expected_manifest = str(self.policy["dataset_manifest_sha256"])
        if manifest_digest(self.public_samples) != expected_manifest:
            raise ValueError("Public dataset does not match the promoted policy manifest")

        self.classifiers = {
            name: joblib.load(self.model_dir / f"{name}.joblib")
            for name in self.component_names
        }
        self.backbones = sorted(
            {COMPONENTS[name][0] for name in self.component_names}
        )
        self.processors: dict[str, Any] = {}
        self.models: dict[str, Any] = {}
        for backbone in self.backbones:
            revision = str(self.policy["backbone_revisions"][backbone])
            self.processors[backbone] = AutoImageProcessor.from_pretrained(
                backbone, revision=revision
            )
            self.models[backbone] = (
                AutoModel.from_pretrained(backbone, revision=revision)
                .eval()
                .to(self.device)
            )

        self.reference_profiles, reference_predictions = self._build_reference_profile()
        self.acquisition_profile = self._build_acquisition_profile()
        self.colour_shift_limit = float(
            np.quantile(
                np.abs(
                    reference_predictions["clean_probability"]
                    - reference_predictions["stress_probability"]
                ),
                STABILITY_QUANTILE,
            )
        )
        self.component_disagreement_limit = float(
            np.quantile(
                reference_predictions["component_standard_deviation"],
                STABILITY_QUANTILE,
            )
        )

    def _build_acquisition_profile(self) -> AcquisitionProfile:
        training_metrics: list[dict[str, float]] = []
        for sample in self.public_samples:
            if sample.split != "train":
                continue
            with Image.open(sample.path) as image:
                training_metrics.append(_acquisition_metrics(image))
        names = tuple(training_metrics[0])
        values = {
            name: np.asarray([row[name] for row in training_metrics], dtype=np.float64)
            for name in names
        }

        def ranges(quantile: float) -> dict[str, tuple[float, float]]:
            return {
                name: (
                    float(np.quantile(metric_values, quantile)),
                    float(np.quantile(metric_values, 1.0 - quantile)),
                )
                for name, metric_values in values.items()
            }

        centres = {
            name: float(np.median(metric_values))
            for name, metric_values in values.items()
        }
        scales = {
            name: max(
                float(
                    1.4826
                    * np.median(np.abs(metric_values - centres[name]))
                ),
                1e-4,
            )
            for name, metric_values in values.items()
        }
        training_scores = np.asarray(
            [
                max(
                    abs((row[name] - centres[name]) / scales[name])
                    for name in names
                )
                for row in training_metrics
            ],
            dtype=np.float64,
        )
        return AcquisitionProfile(
            reference_ranges=ranges(ACQUISITION_QUANTILE),
            severe_ranges=ranges(self.acquisition_tail_quantile),
            robust_centres=centres,
            robust_scales=scales,
            robust_score_limit=float(
                np.quantile(training_scores, ACQUISITION_SCORE_QUANTILE)
            ),
        )

    def _cached_features(self, backbone: str) -> dict[str, np.ndarray]:
        cache = self.benchmark_dir / f"features-{safe_name(backbone)}.npz"
        if not cache.exists():
            raise FileNotFoundError(cache)
        loaded = np.load(cache)
        missing = sorted(set(INFERENCE_VIEWS) - set(loaded.files))
        if missing:
            raise ValueError(f"{cache} lacks required views: {missing}")
        return {name: loaded[name] for name in loaded.files}

    def _build_reference_profile(
        self,
    ) -> tuple[dict[str, ReferenceProfile], dict[str, np.ndarray]]:
        samples = self.public_samples
        train = np.asarray(
            [index for index, sample in enumerate(samples) if sample.split == "train"]
        )
        if len(train) != 682:
            raise ValueError(f"Expected 682 public training images, found {len(train)}")

        cached = {backbone: self._cached_features(backbone) for backbone in self.backbones}
        clean_component: dict[str, np.ndarray] = {}
        stress_component: dict[str, np.ndarray] = {}
        for name in self.component_names:
            backbone, representation_name = COMPONENTS[name]
            representation = next(
                value for value in REPRESENTATIONS if value.name == representation_name
            )
            clean = combine_features(
                cached[backbone],
                representation.clean_views,
                representation.combine,
            )[train]
            stress = combine_features(
                cached[backbone],
                representation.stress_views,
                representation.combine,
            )[train]
            clean_component[name] = np.asarray(
                self.classifiers[name].predict_proba(clean)[:, 1], dtype=np.float64
            )
            stress_component[name] = np.asarray(
                self.classifiers[name].predict_proba(stress)[:, 1], dtype=np.float64
            )

        profiles: dict[str, ReferenceProfile] = {}
        robust_mean = next(
            value for value in REPRESENTATIONS if value.name == "robust_mean"
        )
        train_samples = [samples[int(index)] for index in train]
        for backbone in self.backbones:
            features = combine_features(
                cached[backbone], robust_mean.clean_views, robust_mean.combine
            )[train]
            similarities = _nearest_reference(features, features)
            for left, left_sample in enumerate(train_samples):
                for right, right_sample in enumerate(train_samples):
                    if left_sample.sha256 == right_sample.sha256:
                        similarities[left, right] = -np.inf
            nearest = similarities.max(axis=1)
            profiles[backbone] = ReferenceProfile(
                features=features,
                nearest_neighbour_distribution=nearest,
                similarity_floor=float(np.quantile(nearest, REFERENCE_QUANTILE)),
            )

        clean_matrix = np.stack(
            [clean_component[name] for name in self.component_names], axis=1
        )
        stress_matrix = np.stack(
            [stress_component[name] for name in self.component_names], axis=1
        )
        return profiles, {
            "clean_probability": clean_matrix.mean(axis=1),
            "stress_probability": stress_matrix.mean(axis=1),
            "component_standard_deviation": clean_matrix.std(axis=1),
        }

    def _extract(self, images: Sequence[Image.Image]) -> dict[str, dict[str, np.ndarray]]:
        extracted: dict[str, dict[str, np.ndarray]] = {}
        for backbone in self.backbones:
            processor = self.processors[backbone]
            model = self.models[backbone]
            backbone_features: dict[str, np.ndarray] = {}
            for view in INFERENCE_VIEWS:
                rendered = [render_view(image, view) for image in images]
                inputs = processor(images=rendered, return_tensors="pt")
                inputs = {
                    name: value.to(self.device) for name, value in inputs.items()
                }
                with torch.inference_mode():
                    output = model(**inputs).pooler_output
                    output = torch.nn.functional.normalize(output, p=2, dim=1)
                backbone_features[view] = output.cpu().numpy().astype(np.float32)
            extracted[backbone] = backbone_features
        return extracted

    def predict_images(self, images: Sequence[Image.Image]) -> list[dict[str, Any]]:
        if not images:
            return []
        prepared = [ImageOps.exif_transpose(image).convert("RGB") for image in images]
        acquisition_metrics = [_acquisition_metrics(image) for image in prepared]
        extracted = self._extract(prepared)

        clean_component: dict[str, np.ndarray] = {}
        stress_component: dict[str, np.ndarray] = {}
        for name in self.component_names:
            backbone, representation_name = COMPONENTS[name]
            representation = next(
                value for value in REPRESENTATIONS if value.name == representation_name
            )
            clean = combine_features(
                extracted[backbone],
                representation.clean_views,
                representation.combine,
            )
            stress = combine_features(
                extracted[backbone],
                representation.stress_views,
                representation.combine,
            )
            clean_component[name] = np.asarray(
                self.classifiers[name].predict_proba(clean)[:, 1], dtype=np.float64
            )
            stress_component[name] = np.asarray(
                self.classifiers[name].predict_proba(stress)[:, 1], dtype=np.float64
            )

        clean_matrix = np.stack(
            [clean_component[name] for name in self.component_names], axis=1
        )
        stress_matrix = np.stack(
            [stress_component[name] for name in self.component_names], axis=1
        )
        clean_probability = clean_matrix.mean(axis=1)
        stress_probability = stress_matrix.mean(axis=1)

        robust_mean = next(
            value for value in REPRESENTATIONS if value.name == "robust_mean"
        )
        similarities: dict[str, np.ndarray] = {}
        percentiles: dict[str, np.ndarray] = {}
        for backbone in self.backbones:
            query = combine_features(
                extracted[backbone], robust_mean.clean_views, robust_mean.combine
            )
            profile = self.reference_profiles[backbone]
            nearest = _nearest_reference(query, profile.features).max(axis=1)
            similarities[backbone] = nearest
            percentiles[backbone] = np.asarray(
                [
                    np.mean(profile.nearest_neighbour_distribution <= value)
                    for value in nearest
                ],
                dtype=np.float64,
            )

        results: list[dict[str, Any]] = []
        for index in range(len(prepared)):
            clean_value = float(clean_probability[index])
            stress_value = float(stress_probability[index])
            clean_positive = clean_value >= self.threshold
            stress_positive = stress_value >= self.threshold
            component_std = float(clean_matrix[index].std())
            colour_shift = abs(clean_value - stress_value)
            acquisition_values = acquisition_metrics[index]
            acquisition_outliers = [
                name
                for name, value in acquisition_values.items()
                if not (
                    self.acquisition_profile.reference_ranges[name][0]
                    <= value
                    <= self.acquisition_profile.reference_ranges[name][1]
                )
            ]
            acquisition_severe_outliers = [
                name
                for name, value in acquisition_values.items()
                if not (
                    self.acquisition_profile.severe_ranges[name][0]
                    <= value
                    <= self.acquisition_profile.severe_ranges[name][1]
                )
            ]
            acquisition_robust_score = max(
                abs(
                    (
                        value
                        - self.acquisition_profile.robust_centres[name]
                    )
                    / self.acquisition_profile.robust_scales[name]
                )
                for name, value in acquisition_values.items()
            )
            acquisition_out_of_range = bool(acquisition_severe_outliers)
            backbone_evidence = {
                backbone: {
                    "nearest_public_training_similarity": float(
                        similarities[backbone][index]
                    ),
                    "public_training_reference_percentile": float(
                        percentiles[backbone][index]
                    ),
                    "similarity_floor_p01": self.reference_profiles[
                        backbone
                    ].similarity_floor,
                }
                for backbone in self.backbones
            }
            out_of_reference = any(
                evidence["nearest_public_training_similarity"]
                < evidence["similarity_floor_p01"]
                for evidence in backbone_evidence.values()
            )

            review_reasons = [
                "Research-only external-photo model; local cytology-grounded validation is still required."
            ]
            if out_of_reference:
                review_reasons.append(
                    "Image representation falls below the public training reference floor."
                )
            if clean_positive != stress_positive:
                review_reasons.append(
                    "The binary suggestion changes under the synthetic dark-coat view."
                )
            if colour_shift > self.colour_shift_limit:
                review_reasons.append(
                    "Colour-view probability shift exceeds the public-training p95."
                )
            if component_std > self.component_disagreement_limit:
                review_reasons.append(
                    "Ensemble-head disagreement exceeds the public-training p95."
                )
            if acquisition_out_of_range:
                review_reasons.append(
                    "Acquisition colour or exposure falls outside the public-training envelope."
                )
            if abs(clean_value - self.threshold) < 0.05:
                review_reasons.append(
                    "The binary probability is close to the training-selected threshold."
                )

            abstention_reasons = []
            if out_of_reference:
                abstention_reasons.append("out_of_public_training_reference")
            if clean_positive != stress_positive:
                abstention_reasons.append("clean_dark_coat_disagreement")
            if acquisition_out_of_range:
                abstention_reasons.append("acquisition_colour_or_exposure_out_of_range")
            raw_suggestion = POSITIVE if clean_positive else NEGATIVE
            reference_backed_suggestion = (
                raw_suggestion if not abstention_reasons else None
            )

            results.append(
                {
                    "task": "external_photo_binary_estrus_group",
                    "binary_suggestion": raw_suggestion,
                    "reference_backed_binary_suggestion": reference_backed_suggestion,
                    "decision_status": (
                        "reference_backed_suggestion"
                        if reference_backed_suggestion is not None
                        else "abstain"
                    ),
                    "abstention_reasons": abstention_reasons,
                    "probability_proestrus_or_estrus": clean_value,
                    "threshold": self.threshold,
                    "synthetic_dark_coat": {
                        "binary_suggestion": POSITIVE if stress_positive else NEGATIVE,
                        "probability_proestrus_or_estrus": stress_value,
                        "agrees_with_clean": clean_positive == stress_positive,
                        "absolute_probability_shift": colour_shift,
                        "public_training_p95_shift": self.colour_shift_limit,
                    },
                    "ensemble": {
                        "system": self.system_name,
                        "components": len(self.component_names),
                        "component_probability_standard_deviation": component_std,
                        "public_training_p95_standard_deviation": self.component_disagreement_limit,
                    },
                    "reference_domain": {
                        "out_of_reference": out_of_reference,
                        "backbones": backbone_evidence,
                    },
                    "acquisition_domain": {
                        "out_of_range": acquisition_out_of_range,
                        "outlier_metrics": acquisition_outliers,
                        "severe_outlier_metrics": acquisition_severe_outliers,
                        "robust_outlier_score": acquisition_robust_score,
                        "public_training_robust_score_p995": self.acquisition_profile.robust_score_limit,
                        "metrics": acquisition_values,
                        "public_training_reference_ranges_p01_p99": {
                            name: {"low": bounds[0], "high": bounds[1]}
                            for name, bounds in self.acquisition_profile.reference_ranges.items()
                        },
                    },
                    "input_contract": {
                        "modality": "external_genital_photo",
                        "roi_required": True,
                        "cytology_input": False,
                        "four_stage_output": False,
                    },
                    "review_required": True,
                    "review_reasons": review_reasons,
                    "model_version": self.model_version,
                }
            )
        return results

    def predict_image(self, image: Image.Image) -> dict[str, Any]:
        return self.predict_images([image])[0]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run guarded S-BIAD2395 binary external-photo inference"
    )
    parser.add_argument("--image", type=Path, action="append", required=True)
    parser.add_argument("--model-dir", type=Path, required=True)
    parser.add_argument("--benchmark-dir", type=Path, required=True)
    parser.add_argument("--public-data-dir", type=Path, required=True)
    parser.add_argument(
        "--device", choices=("auto", "mps", "cuda", "cpu"), default="auto"
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    predictor = PublicBinaryInference(
        model_dir=args.model_dir,
        benchmark_dir=args.benchmark_dir,
        public_data_dir=args.public_data_dir,
        device=args.device,
    )
    images = [Image.open(path) for path in args.image]
    predictions = predictor.predict_images(images)
    print(
        json.dumps(
            [
                {"image": str(path.resolve()), **prediction}
                for path, prediction in zip(args.image, predictions, strict=True)
            ],
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
