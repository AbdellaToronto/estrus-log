-- Migration: Clean up orphaned organization data
-- This migration:
-- 1. Creates placeholder org profiles for any orphaned org_ids (from deleted Clerk orgs)
-- 2. Ensures mice inherit org_id from their cohort (data integrity fix)
-- 3. Adds documentation comment

-- 1. Create placeholder org profiles for orphaned org_ids in cohorts
-- This allows users to still see their data is associated with "deleted" orgs
INSERT INTO organization_profiles (clerk_org_id, department, institution, is_discoverable, description)
SELECT DISTINCT c.org_id, 
       'Deleted Lab', 
       NULL, 
       false,
       'This lab has been deleted. Data is preserved for historical reference.'
FROM cohorts c
LEFT JOIN organization_profiles op ON c.org_id = op.clerk_org_id
WHERE c.org_id IS NOT NULL 
  AND op.id IS NULL
ON CONFLICT (clerk_org_id) DO NOTHING;

-- Also for mice that might have orphaned org_ids
INSERT INTO organization_profiles (clerk_org_id, department, institution, is_discoverable, description)
SELECT DISTINCT m.org_id, 
       'Deleted Lab', 
       NULL, 
       false,
       'This lab has been deleted. Data is preserved for historical reference.'
FROM mice m
LEFT JOIN organization_profiles op ON m.org_id = op.clerk_org_id
WHERE m.org_id IS NOT NULL 
  AND op.id IS NULL
ON CONFLICT (clerk_org_id) DO NOTHING;

-- 2. Fix mice where org_id doesn't match their cohort's org_id
-- This is a data integrity fix: subjects should inherit org from their cohort
UPDATE mice m
SET org_id = c.org_id
FROM cohorts c
WHERE m.cohort_id = c.id
  AND m.org_id IS DISTINCT FROM c.org_id;

-- 3. Add a comment to document this table's purpose
COMMENT ON TABLE organization_profiles IS 
'Organization profiles for Clerk organizations. May include placeholder profiles for deleted orgs to preserve data association.';

