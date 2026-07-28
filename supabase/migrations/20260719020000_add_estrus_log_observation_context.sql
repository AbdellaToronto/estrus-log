-- Promote the observation contract into queryable fields while retaining the
-- flexible JSON record for backwards compatibility and model evidence.
ALTER TABLE estrus_logs
  ADD COLUMN IF NOT EXISTS modality text,
  ADD COLUMN IF NOT EXISTS capture_date date,
  ADD COLUMN IF NOT EXISTS label_status text,
  ADD COLUMN IF NOT EXISTS confirmation_source text,
  ADD COLUMN IF NOT EXISTS reviewer_id text;

ALTER TABLE estrus_logs
  ADD CONSTRAINT estrus_logs_modality_check
  CHECK (modality IS NULL OR modality IN ('external_photo', 'vaginal_cytology'));

ALTER TABLE estrus_logs
  ADD CONSTRAINT estrus_logs_label_status_check
  CHECK (label_status IS NULL OR label_status IN ('confirmed', 'uncertain_or_transition'));

-- Best-effort backfill from the review-first JSON records. Values that do not
-- fit the contract remain NULL instead of being silently coerced.
UPDATE estrus_logs
SET
  modality = CASE
    WHEN data->'observation_context'->>'modality' IN ('external_photo', 'vaginal_cytology')
      THEN data->'observation_context'->>'modality'
    ELSE modality
  END,
  capture_date = CASE
    WHEN data->'observation_context'->>'capture_date' ~ '^\d{4}-\d{2}-\d{2}$'
      THEN (data->'observation_context'->>'capture_date')::date
    ELSE capture_date
  END,
  label_status = CASE
    WHEN data->'observation_context'->>'label_status' IN ('confirmed', 'uncertain_or_transition')
      THEN data->'observation_context'->>'label_status'
    ELSE label_status
  END,
  confirmation_source = COALESCE(data->'observation_context'->>'confirmation_source', confirmation_source)
WHERE data ? 'observation_context';

CREATE INDEX IF NOT EXISTS idx_estrus_logs_modality_capture_date
  ON estrus_logs (modality, capture_date DESC);
