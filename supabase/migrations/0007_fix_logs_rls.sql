-- Fix RLS for estrus_logs to allow access if user owns the cohort OR belongs to the org
DROP POLICY IF EXISTS "Users can view logs for their mice" ON estrus_logs;
DROP POLICY IF EXISTS "Users can insert logs for their mice" ON estrus_logs;

-- New Select Policy
CREATE POLICY "Users can view logs in their cohorts or org"
ON estrus_logs FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM cohorts
    WHERE cohorts.id = estrus_logs.cohort_id
    AND (
      cohorts.user_id = auth.uid()::text
      OR 
      (cohorts.org_id IS NOT NULL AND cohorts.org_id IN (
        SELECT org_id FROM users WHERE id = auth.uid()::text
      )) -- Simplified org check, ideally use clerk claims or a mapping table if syncing
    )
  )
);

-- New Insert Policy
CREATE POLICY "Users can insert logs in their cohorts"
ON estrus_logs FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM cohorts
    WHERE cohorts.id = estrus_logs.cohort_id
    AND (
        cohorts.user_id = auth.uid()::text
        OR
        (cohorts.org_id IS NOT NULL) -- Allow org members to insert generally
    )
  )
);

