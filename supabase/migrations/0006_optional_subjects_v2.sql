-- Add cohort_id to estrus_logs to support unassigned logs
ALTER TABLE estrus_logs ADD COLUMN cohort_id uuid REFERENCES cohorts(id);

-- Backfill cohort_id from existing mice relationships
UPDATE estrus_logs
SET cohort_id = mice.cohort_id
FROM mice
WHERE estrus_logs.mouse_id = mice.id;

-- Make mouse_id nullable
ALTER TABLE estrus_logs ALTER COLUMN mouse_id DROP NOT NULL;

-- Index for performance
CREATE INDEX idx_estrus_logs_cohort_id ON estrus_logs(cohort_id);

