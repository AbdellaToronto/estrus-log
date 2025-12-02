-- Migration: Add session_id to estrus_logs for linking to scan_sessions

-- 1. Add session_id column to estrus_logs
ALTER TABLE estrus_logs ADD COLUMN IF NOT EXISTS session_id uuid REFERENCES scan_sessions(id);

-- 2. Create index for efficient lookups by session
CREATE INDEX IF NOT EXISTS idx_estrus_logs_session_id ON estrus_logs(session_id);

-- 3. Backfill: Create scan_sessions from existing estrus_logs grouped by cohort + date
INSERT INTO scan_sessions (id, cohort_id, user_id, status, name, created_at)
SELECT 
  gen_random_uuid() as id,
  el.cohort_id,
  c.user_id,
  'completed' as status,
  'Batch Scan ' || TO_CHAR(MIN(el.created_at) AT TIME ZONE 'UTC', 'MM/DD/YYYY') as name,
  MIN(el.created_at) as created_at
FROM estrus_logs el
JOIN cohorts c ON el.cohort_id = c.id
WHERE el.cohort_id IS NOT NULL
  AND el.session_id IS NULL
GROUP BY el.cohort_id, c.user_id, DATE(el.created_at AT TIME ZONE 'UTC')
ON CONFLICT DO NOTHING;

-- 4. Link estrus_logs to their corresponding sessions
UPDATE estrus_logs el
SET session_id = ss.id
FROM scan_sessions ss
WHERE el.cohort_id = ss.cohort_id
  AND DATE(el.created_at AT TIME ZONE 'UTC') = DATE(ss.created_at AT TIME ZONE 'UTC')
  AND el.session_id IS NULL;

-- 5. Clean up old empty scan_sessions that have no linked data
DELETE FROM scan_sessions ss
WHERE NOT EXISTS (
  SELECT 1 FROM scan_items si WHERE si.session_id = ss.id
)
AND NOT EXISTS (
  SELECT 1 FROM estrus_logs el WHERE el.session_id = ss.id
);

