# Local development

Estrus runs against a complete local Supabase stack on ports `55321`–`55329`, so it will not conflict with another local Supabase project. The optional Supabase Vector service is excluded because Colima cannot mount its Docker socket on this Mac; Estrus does not use that service.

## First run

```bash
pnpm install
pnpm db:start
pnpm dev:local
```

Open `http://localhost:3000` (use `localhost`, not `127.0.0.1`, because Clerk's development allow-list is origin-specific). Sign in with the existing Clerk development account; `dev:local` preserves the Clerk settings from `.env.local` but overrides Supabase with the local API and database.

## Everyday commands

```bash
pnpm db:status  # local API, Studio, and database connection details
pnpm db:reset   # recreate the local database from supabase/migrations
pnpm db:stop    # stop only the Estrus Supabase stack
```

## Local-only authorization mode

The production app uses Clerk JWTs with Supabase row-level security. Local Supabase has its own signing key, so `dev:local` deliberately enables `ESTRUS_LOCAL_DEVELOPMENT=true`: server actions use the local service key while Clerk still supplies the current user identity. This is restricted to the local command and must never be set in Vercel or another shared environment.

The database starts empty. The first cohort you create also creates/synchronizes your local user record; from then on, all app data remains in the local database.

## Optional public binary research cross-check

The evaluated S-BIAD2395 ensemble can run as a separate local service. It accepts a scientist-confirmed external-genital ROI and returns only the validated binary task: `PROESTRUS_OR_ESTRUS` versus `METESTRUS_OR_DIESTRUS`. It does not accept cytology and does not produce a four-stage label.

Install the Python service environment and start it from the repository root:

```bash
uv venv work/model-eval/.venv
uv pip install --python work/model-eval/.venv/bin/python -r python-service/requirements.txt
ESTRUS_BINARY_API_TOKEN=choose-a-local-secret \
  work/model-eval/.venv/bin/python -m uvicorn \
  public_binary_api:app --app-dir python-service --port 8001
```

Add the matching values to `.env.local`, then restart Next.js:

```bash
ESTRUS_BINARY_MODEL_API_URL=http://127.0.0.1:8001
ESTRUS_BINARY_API_TOKEN=choose-a-local-secret
```

The default artifact paths point at the locally reproduced benchmark under `work/model-eval`. The tracked v2 decision policy pins the independently training-selected 0.579 threshold and verifies the base report hash. Override `ESTRUS_BINARY_MODEL_DIR`, `ESTRUS_BINARY_BENCHMARK_DIR`, `ESTRUS_BINARY_PUBLIC_DATA_DIR`, or `ESTRUS_BINARY_POLICY_PATH` only when those artifacts live elsewhere.

In the log-entry dialog, the cross-check runs only when the user confirms that the external genital region is centered and fills most of the image. The raw research score is retained for inspection, but the service abstains from a reference-backed suggestion when clean and synthetic-dark views disagree, the image falls below the public training-reference floor, or its colour/exposure falls outside the training-only acquisition envelope. The dialog shows separate dark-coat stability, reference-domain, and colour/exposure badges. Every result remains review-required.

## Collecting paired cytology ground truth

For an external-photo observation, choose **Paired vaginal cytology** in the review step, upload the smear image used for the stage decision, and add the slide/sample ID when available. Both images remain private. The saved row records the external photo and cytology reference separately and is labelled `paired_cytology_review`; visual-review rows cannot be mistaken for cytology-grounded labels. Open each subject page and record coat colour plus strain/stock before exporting if the cohort will be used for colour-robustness claims.

After exporting a cohort CSV, verify that it is structurally ready for grouped evaluation:

```bash
work/model-eval/.venv/bin/python \
  python-service/prepare_cytology_grounded_evaluation.py \
  --export /path/to/cohort-export.csv \
  --output-dir work/model-eval/local-cytology-ground-truth \
  --require-coat-colour \
  --strict
```

The command preserves private object references without downloading images. It exits non-zero for incomplete explicit pairings and will not create a held-out split until at least five subjects are represented. With `--require-coat-colour`, it also refuses a colour claim until at least two recorded groups clear the held-out support gates.

Run `python-service/run_cytology_grounded_binary_holdout.py` with the records CSV, its preflight JSON, and an explicit `object_reference,local_path` image map (or opt in to GCS downloads). It executes the same guarded ensemble used by the local service, skips all training rows, and neither opens cytology images nor uses the true-stage column. Its `binary-heldout-predictions.csv` can then be passed to `python-service/evaluate_cytology_grounded_binary_predictions.py` for subject-cluster confidence intervals and coat/strain/device/reviewer subgroup metrics. Predictions for training rows or IDs outside the preflight manifest are rejected.
