#!/usr/bin/env bash
#
# Deploy the promoted external-photo binary model to Cloud Run.
#
# Chosen because this project already has GCP credentials, a project with Cloud
# Run services in it, and the model artifacts in its own bucket. Vercel Functions
# cannot host torch, and Modal would need a separate account token.
#
# The service scales to zero, so it costs nothing idle and pays a model-load cold
# start on the first request after a quiet period.
#
# Usage:
#   ./scripts/deploy-binary-model.sh [--account you@example.com]
#
# Requires: gcloud authenticated with an account that can deploy Cloud Run, and
# read access to the artifact bucket.

set -euo pipefail

MODEL_VERSION="s-biad2395-dinov2-robust-ensemble-20260719-v2"
SERVICE="estrus-binary-model"
REGION="${GCP_REGION:-us-central1}"
PROJECT="${GCP_PROJECT_ID:-llm-config-services}"
BUCKET="${GCS_BUCKET_NAME:-estrus-data-llm-config-services}"
ARTIFACTS="gs://${BUCKET}/model-artifacts/${MODEL_VERSION}"

ACCOUNT_FLAG=()
if [[ "${1:-}" == "--account" && -n "${2:-}" ]]; then
  ACCOUNT_FLAG=(--account "$2")
fi

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${REPO_ROOT}"

STAGING="$(mktemp -d)"
trap 'rm -rf "${STAGING}"' EXIT

echo "Staging build context in ${STAGING}"
mkdir -p "${STAGING}/python-service" "${STAGING}/artifacts"
cp python-service/public_binary_inference.py \
   python-service/public_binary_api.py \
   python-service/benchmark_public_external_binary.py \
   "${STAGING}/python-service/"
cp -R python-service/model-policies "${STAGING}/python-service/"
cp python-service/Dockerfile.binary-model "${STAGING}/Dockerfile"

echo "Pulling model artifacts from ${ARTIFACTS}"
gsutil -m -q cp -r "${ARTIFACTS}/public-confirmatory-20260719" "${STAGING}/artifacts/"
gsutil -m -q cp -r "${ARTIFACTS}/public-foundation-benchmark-20260719" "${STAGING}/artifacts/"

# The acquisition guard is fitted from the public training images. They are not in
# the bucket because they are redistributable from EBI; fetch them if a local copy
# exists, otherwise ship an empty directory and let the guard degrade.
mkdir -p "${STAGING}/artifacts/public-data"
LOCAL_PUBLIC_DATA="work/model-eval/public/S-BIAD2395/estrus images"
if [[ -d "${LOCAL_PUBLIC_DATA}" ]]; then
  echo "Including local public training images for the acquisition guard"
  cp -R "${LOCAL_PUBLIC_DATA}/." "${STAGING}/artifacts/public-data/"
else
  echo "WARNING: ${LOCAL_PUBLIC_DATA} not found." >&2
  echo "         Run ./scripts/download-s-biad2395.sh first for the acquisition guard." >&2
  touch "${STAGING}/artifacts/public-data/.keep"
fi

TOKEN="${ESTRUS_BINARY_API_TOKEN:-}"
if [[ -z "${TOKEN}" ]]; then
  echo "ESTRUS_BINARY_API_TOKEN is not set; generating one for this deployment." >&2
  TOKEN="$(openssl rand -hex 24)"
  echo "  Generated token: ${TOKEN}" >&2
  echo "  Set the same value in Vercel as ESTRUS_BINARY_API_TOKEN." >&2
fi

echo "Deploying ${SERVICE} to ${PROJECT}/${REGION}"
gcloud run deploy "${SERVICE}" \
  "${ACCOUNT_FLAG[@]}" \
  --project "${PROJECT}" \
  --region "${REGION}" \
  --source "${STAGING}" \
  --allow-unauthenticated \
  --memory 4Gi \
  --cpu 2 \
  --timeout 300 \
  --concurrency 4 \
  --min-instances 0 \
  --max-instances 3 \
  --set-env-vars "ESTRUS_BINARY_API_TOKEN=${TOKEN}" \
  --quiet

URL="$(gcloud run services describe "${SERVICE}" "${ACCOUNT_FLAG[@]}" \
        --project "${PROJECT}" --region "${REGION}" --format 'value(status.url)')"

cat <<EOF

Deployed ${MODEL_VERSION}

  ESTRUS_BINARY_MODEL_API_URL=${URL}
  ESTRUS_BINARY_API_TOKEN=${TOKEN}

Add both to Vercel:

  vercel env add ESTRUS_BINARY_MODEL_API_URL production
  vercel env add ESTRUS_BINARY_API_TOKEN production

The service scales to zero, so the first request after an idle period pays a
model-load cold start.
EOF
