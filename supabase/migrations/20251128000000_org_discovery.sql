-- Organization Discovery & Join Requests
-- Enables users to discover and request to join existing organizations

-- =============================================================================
-- Organization Metadata (extends Clerk orgs with discoverable info)
-- =============================================================================
create table if not exists organization_profiles (
  id uuid primary key default gen_random_uuid(),
  clerk_org_id text unique not null,
  
  -- Discoverability
  is_discoverable boolean default false,
  institution text, -- e.g., "UC Davis", "Stanford University"
  department text,  -- e.g., "Biology Department"
  
  -- Display info
  description text,
  website_url text,
  logo_url text,
  
  -- Stats (denormalized for quick display)
  member_count int default 1,
  
  -- Metadata
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- =============================================================================
-- Join Requests
-- =============================================================================
create type join_request_status as enum ('pending', 'approved', 'denied', 'cancelled');

create table if not exists join_requests (
  id uuid primary key default gen_random_uuid(),
  
  -- Who's requesting
  user_id text not null, -- Clerk user ID
  user_email text not null,
  user_name text,
  
  -- Which org
  organization_id uuid not null references organization_profiles(id) on delete cascade,
  
  -- Request details
  message text, -- Optional message from requester
  role text default 'member', -- Requested role
  
  -- Status tracking
  status join_request_status default 'pending',
  reviewed_by text, -- Clerk user ID of reviewer
  reviewed_at timestamptz,
  review_note text, -- Internal note from reviewer
  
  -- Timestamps
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  
  -- Prevent duplicate pending requests
  unique(user_id, organization_id, status)
);

-- =============================================================================
-- Indexes
-- =============================================================================
create index idx_org_profiles_discoverable on organization_profiles(is_discoverable) where is_discoverable = true;
create index idx_org_profiles_institution on organization_profiles(institution);
create index idx_org_profiles_clerk_id on organization_profiles(clerk_org_id);

create index idx_join_requests_org on join_requests(organization_id);
create index idx_join_requests_user on join_requests(user_id);
create index idx_join_requests_status on join_requests(status);
create index idx_join_requests_pending on join_requests(organization_id, status) where status = 'pending';

-- =============================================================================
-- RLS Policies
-- =============================================================================
alter table organization_profiles enable row level security;
alter table join_requests enable row level security;

-- Organization profiles: anyone can read discoverable orgs
create policy "Anyone can view discoverable organizations"
  on organization_profiles for select
  using (is_discoverable = true);

-- Organization profiles: org members can view their own org (even if not discoverable)
create policy "Org members can view their organization"
  on organization_profiles for select
  using (true); -- We'll filter by Clerk org membership in the app

-- Organization profiles: org admins can update their org
create policy "Authenticated users can update org profiles"
  on organization_profiles for update
  to authenticated
  using (true); -- We'll verify admin status via Clerk in the app

-- Organization profiles: authenticated users can insert (when creating org)
create policy "Authenticated users can create org profiles"
  on organization_profiles for insert
  to authenticated
  with check (true);

-- Join requests: users can view their own requests
create policy "Users can view their own join requests"
  on join_requests for select
  using (true); -- We'll filter by user_id in the app

-- Join requests: users can create requests
create policy "Authenticated users can create join requests"
  on join_requests for insert
  to authenticated
  with check (true);

-- Join requests: users can cancel their own pending requests
create policy "Users can update their own requests"
  on join_requests for update
  to authenticated
  using (true); -- We'll verify ownership in the app

-- =============================================================================
-- Functions
-- =============================================================================

-- Function to search discoverable organizations
create or replace function search_organizations(
  search_query text default null,
  institution_filter text default null,
  limit_count int default 20
)
returns table (
  id uuid,
  clerk_org_id text,
  institution text,
  department text,
  description text,
  logo_url text,
  member_count int,
  created_at timestamptz
)
language plpgsql
security definer
as $$
begin
  return query
  select 
    op.id,
    op.clerk_org_id,
    op.institution,
    op.department,
    op.description,
    op.logo_url,
    op.member_count,
    op.created_at
  from organization_profiles op
  where op.is_discoverable = true
    and (search_query is null or (
      op.institution ilike '%' || search_query || '%'
      or op.department ilike '%' || search_query || '%'
      or op.description ilike '%' || search_query || '%'
    ))
    and (institution_filter is null or op.institution = institution_filter)
  order by op.member_count desc, op.created_at desc
  limit limit_count;
end;
$$;

-- Function to get pending requests for an organization
create or replace function get_pending_requests(org_clerk_id text)
returns table (
  id uuid,
  user_id text,
  user_email text,
  user_name text,
  message text,
  role text,
  created_at timestamptz
)
language plpgsql
security definer
as $$
begin
  return query
  select 
    jr.id,
    jr.user_id,
    jr.user_email,
    jr.user_name,
    jr.message,
    jr.role,
    jr.created_at
  from join_requests jr
  join organization_profiles op on jr.organization_id = op.id
  where op.clerk_org_id = org_clerk_id
    and jr.status = 'pending'
  order by jr.created_at asc;
end;
$$;

