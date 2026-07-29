#!/usr/bin/env bash
#
# Fetch the promoted external-photo binary model's runtime artifacts.
#
# The serving code and policy live in Git; the fitted classifier heads and the
# DINOv2 feature caches do not. They are ~43 MB of binary blobs that Vercel never
# needs at build time — the model serves from a separate FastAPI process — so
# they live in object storage instead of permanently inflating the repository.
#
# The DINOv2 backbones themselves are not stored here either. They download from
# Hugging Face at the revisions pinned in the policy JSON.
#
# Usage:
#   ./scripts/fetch-model-artifacts.sh [destination]
#
# Requires an authenticated gcloud/gsutil with read access to the bucket.

set -euo pipefail

MODEL_VERSION="s-biad2395-dinov2-robust-ensemble-20260719-v2"
BUCKET="${GCS_BUCKET_NAME:-estrus-data-llm-config-services}"
SOURCE="gs://${BUCKET}/model-artifacts/${MODEL_VERSION}"
DESTINATION="${1:-work/model-eval}"

if ! command -v gsutil >/dev/null 2>&1; then
  echo "gsutil not found. Install the Google Cloud SDK first." >&2
  exit 1
fi

echo "Fetching ${MODEL_VERSION} from ${SOURCE}"
mkdir -p "${DESTINATION}"

# Classifier heads: eight fitted logistic/RBF heads over DINOv2 features.
gsutil -m cp -r "${SOURCE}/public-confirmatory-20260719" "${DESTINATION}/"

# Feature caches: needed at inference time by the out-of-reference guard, which
# compares a query embedding against the public training features.
gsutil -m cp -r "${SOURCE}/public-foundation-benchmark-20260719" "${DESTINATION}/"

cat <<EOF

Fetched to ${DESTINATION}/

The acquisition guard is fitted from the public training images, which are not in
the bucket — they are redistributable from EBI BioStudies instead:

  ./scripts/download-s-biad2395.sh

Then serve the model with:

  ESTRUS_BINARY_MODEL_DIR=${DESTINATION}/public-confirmatory-20260719 \\
  ESTRUS_BINARY_BENCHMARK_DIR=${DESTINATION}/public-foundation-benchmark-20260719 \\
  ESTRUS_BINARY_API_TOKEN=<a-local-secret> \\
  uvicorn public_binary_api:app --app-dir python-service --port 8001

and point the app at it with ESTRUS_BINARY_MODEL_API_URL=http://127.0.0.1:8001
EOF
