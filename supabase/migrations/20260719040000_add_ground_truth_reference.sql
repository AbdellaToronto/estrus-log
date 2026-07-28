-- Make photo-to-cytology pairing a queryable scientific contract instead of
-- burying the reference evidence in free-form JSON.
ALTER TABLE estrus_logs
  ADD COLUMN IF NOT EXISTS reference_modality text,
  ADD COLUMN IF NOT EXISTS reference_image_url text,
  ADD COLUMN IF NOT EXISTS reference_sample_id text;

ALTER TABLE estrus_logs
  ADD CONSTRAINT estrus_logs_reference_modality_check
  CHECK (reference_modality IS NULL OR reference_modality = 'vaginal_cytology');

ALTER TABLE estrus_logs
  ADD CONSTRAINT estrus_logs_paired_cytology_contract_check
  CHECK (
    confirmation_source IS DISTINCT FROM 'paired_cytology_review'
    OR (
      modality = 'external_photo'
      AND reference_modality = 'vaginal_cytology'
      AND reference_image_url IS NOT NULL
      AND length(trim(reference_image_url)) > 0
    )
  );

CREATE INDEX IF NOT EXISTS idx_estrus_logs_ground_truth_reference
  ON estrus_logs (confirmation_source, reference_modality, capture_date DESC);

COMMENT ON COLUMN estrus_logs.reference_image_url IS
  'Private object reference for the paired vaginal-cytology image used to confirm an external-photo stage.';

COMMENT ON COLUMN estrus_logs.reference_sample_id IS
  'Optional lab sample or slide identifier linking the external photo to its cytology preparation.';
