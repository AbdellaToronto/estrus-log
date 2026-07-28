-- Preserve the specimen contract at the batch/session level. Batch analysis is
-- only valid for external genital photos; cytology remains a manual workflow
-- until a modality-specific model is validated.
ALTER TABLE scan_sessions
  ADD COLUMN IF NOT EXISTS modality text,
  ADD COLUMN IF NOT EXISTS capture_date date;

ALTER TABLE scan_sessions
  ADD CONSTRAINT scan_sessions_modality_check
  CHECK (modality IS NULL OR modality IN ('external_photo', 'vaginal_cytology'));

COMMENT ON COLUMN scan_sessions.modality IS
  'Specimen modality declared by the scientist before batch upload.';
COMMENT ON COLUMN scan_sessions.capture_date IS
  'Date the specimens were captured, distinct from session creation time.';
