-- Fix RLS for estrus_logs to rely on cohort_id instead of mouse_id
-- This allows access to logs that are not yet assigned to a subject (mouse_id is null)

-- Drop old policies (names might vary, so using IF EXISTS or just dropping by name from previous migrations)
DROP POLICY IF EXISTS "Users can view logs for their mice" ON estrus_logs;
DROP POLICY IF EXISTS "Users can insert logs for their mice" ON estrus_logs;
-- Also drop the original init ones if they somehow survived (though 0001 dropped them)

-- Create new SELECT policy
CREATE POLICY "Users can view logs for their cohorts" ON estrus_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM cohorts
      WHERE cohorts.id = estrus_logs.cohort_id
      AND (
        cohorts.user_id = requesting_user_id() -- Uses the helper that handles Clerk IDs
        OR 
        (cohorts.org_id IS NOT NULL AND cohorts.org_id = requesting_org_id())
      )
    )
  );

-- Create new INSERT policy
CREATE POLICY "Users can insert logs for their cohorts" ON estrus_logs
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM cohorts
      WHERE cohorts.id = estrus_logs.cohort_id
      AND (
        cohorts.user_id = requesting_user_id()
        OR 
        (cohorts.org_id IS NOT NULL AND cohorts.org_id = requesting_org_id())
      )
    )
  );

-- Create new UPDATE policy
CREATE POLICY "Users can update logs for their cohorts" ON estrus_logs
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM cohorts
      WHERE cohorts.id = estrus_logs.cohort_id
      AND (
        cohorts.user_id = requesting_user_id()
        OR 
        (cohorts.org_id IS NOT NULL AND cohorts.org_id = requesting_org_id())
      )
    )
  );

-- Create new DELETE policy
CREATE POLICY "Users can delete logs for their cohorts" ON estrus_logs
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM cohorts
      WHERE cohorts.id = estrus_logs.cohort_id
      AND (
        cohorts.user_id = requesting_user_id()
        OR 
        (cohorts.org_id IS NOT NULL AND cohorts.org_id = requesting_org_id())
      )
    )
  );

