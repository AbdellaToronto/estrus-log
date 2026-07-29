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

# Storage reads use whichever account can see the bucket, which is not
# necessarily the deploying account. `gcloud storage` rather than `gsutil`: gsutil
# resolves a default project from global config and hangs when that project is
# unrelated to the bucket.
STORAGE_ACCOUNT="${GCS_READ_ACCOUNT:-}"
STORAGE_FLAGS=(--project "${PROJECT}")
if [[ -n "${STORAGE_ACCOUNT}" ]]; then
  STORAGE_FLAGS+=(--account "${STORAGE_ACCOUNT}")
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
# A local copy is authoritative when present; the bucket is the fallback.
if [[ -d "work/model-eval/public-confirmatory-20260719" ]]; then
  echo "  using local artifacts"
  cp -R work/model-eval/public-confirmatory-20260719 "${STAGING}/artifacts/"
  cp -R work/model-eval/public-foundation-benchmark-20260719 "${STAGING}/artifacts/"
else
  gcloud storage cp -r "${STORAGE_FLAGS[@]}" \
    "${ARTIFACTS}/public-confirmatory-20260719" "${STAGING}/artifacts/"
  gcloud storage cp -r "${STORAGE_FLAGS[@]}" \
    "${ARTIFACTS}/public-foundation-benchmark-20260719" "${STAGING}/artifacts/"
fi

# The acquisition guard is fitted from the public training images, and the service
# verifies dataset_manifest_sha256 against the policy at startup. A partial or
# missing copy is therefore fatal, not degraded — refuse to build rather than ship
# a container that cannot boot.
#
# `work/` is gitignored, so in a worktree checkout it lives in the main checkout.
# Search both, plus an explicit override.
mkdir -p "${STAGING}/artifacts/public-data"
PUBLIC_DATA=""
for candidate in \
  "${ESTRUS_BINARY_PUBLIC_DATA_DIR:-}" \
  "${REPO_ROOT}/work/model-eval/public/S-BIAD2395/estrus images" \
  "$(git -C "${REPO_ROOT}" rev-parse --path-format=absolute --git-common-dir 2>/dev/null | xargs -I{} dirname {})/work/model-eval/public/S-BIAD2395/estrus images"
do
  if [[ -n "${candidate}" && -d "${candidate}" ]]; then
    PUBLIC_DATA="${candidate}"
    break
  fi
done

EXPECTED_IMAGES=758
if [[ -z "${PUBLIC_DATA}" ]]; then
  echo "ERROR: public training images not found." >&2
  echo "       The service hash-verifies the dataset manifest at startup, so this" >&2
  echo "       is required. Fetch them with ./scripts/download-s-biad2395.sh, or" >&2
  echo "       set ESTRUS_BINARY_PUBLIC_DATA_DIR to an existing copy." >&2
  exit 1
fi

FOUND_IMAGES="$(find "${PUBLIC_DATA}" -type f -name '*.png' | wc -l | tr -d ' ')"
if [[ "${FOUND_IMAGES}" -lt "${EXPECTED_IMAGES}" ]]; then
  echo "ERROR: found ${FOUND_IMAGES} of ${EXPECTED_IMAGES} public images in" >&2
  echo "       ${PUBLIC_DATA}" >&2
  echo "       The startup manifest check needs the complete set." >&2
  exit 1
fi

echo "Including ${FOUND_IMAGES} public training images for the acquisition guard"
cp -R "${PUBLIC_DATA}/." "${STAGING}/artifacts/public-data/"

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
  `# Startup loads eight heads, two DINOv2 backbones, and hashes 758 reference` \
  `# images before serving, which overruns the default probe on CPU.` \
  --startup-probe "tcpSocket.port=8080,initialDelaySeconds=30,periodSeconds=15,failureThreshold=30,timeoutSeconds=10" \
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
