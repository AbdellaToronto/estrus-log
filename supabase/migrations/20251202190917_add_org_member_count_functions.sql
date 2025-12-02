-- Migration: Add organization member count helper functions
-- These functions are called from Clerk webhooks when members join/leave organizations

-- Increment member count when someone joins
CREATE OR REPLACE FUNCTION increment_org_member_count(org_clerk_id TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE organization_profiles 
  SET member_count = COALESCE(member_count, 0) + 1,
      updated_at = NOW()
  WHERE clerk_org_id = org_clerk_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Decrement member count when someone leaves (minimum 0)
CREATE OR REPLACE FUNCTION decrement_org_member_count(org_clerk_id TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE organization_profiles 
  SET member_count = GREATEST(COALESCE(member_count, 1) - 1, 0),
      updated_at = NOW()
  WHERE clerk_org_id = org_clerk_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION increment_org_member_count(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION decrement_org_member_count(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION increment_org_member_count(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION decrement_org_member_count(TEXT) TO service_role;

