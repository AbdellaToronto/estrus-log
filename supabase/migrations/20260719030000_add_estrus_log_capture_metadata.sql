-- Optional protocol context for reproducibility and modality-specific model
-- evaluation. JSONB preserves a lab's terminology while the GIN index keeps
-- common metadata filters practical.
ALTER TABLE estrus_logs
  ADD COLUMN IF NOT EXISTS capture_metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_estrus_logs_capture_metadata
  ON estrus_logs USING gin (capture_metadata);
