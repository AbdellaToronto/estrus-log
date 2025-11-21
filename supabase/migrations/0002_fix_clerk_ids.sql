-- Fix for Clerk IDs (text) causing errors with auth.uid() (uuid)
-- We need to extract the user ID directly from the JWT claims as text

create or replace function requesting_user_id()
returns text as $$
  select nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'sub', '')::text;
$$ language sql stable;

-- Update Policies to use requesting_user_id() instead of auth.uid()

-- Users
drop policy "Users can view their own profile" on users;
create policy "Users can view their own profile" on users
  for select using (requesting_user_id() = id);

-- Cohorts
drop policy "Users can view their own or org cohorts" on cohorts;
create policy "Users can view their own or org cohorts" on cohorts
  for select using (
    requesting_user_id() = user_id 
    or 
    (org_id is not null and org_id = requesting_org_id())
  );

drop policy "Users can insert their own or org cohorts" on cohorts;
create policy "Users can insert their own or org cohorts" on cohorts
  for insert with check (
    requesting_user_id() = user_id 
    or 
    (org_id is not null and org_id = requesting_org_id())
  );

drop policy "Users can update their own or org cohorts" on cohorts;
create policy "Users can update their own or org cohorts" on cohorts
  for update using (
    requesting_user_id() = user_id 
    or 
    (org_id is not null and org_id = requesting_org_id())
  );

drop policy "Users can delete their own or org cohorts" on cohorts;
create policy "Users can delete their own or org cohorts" on cohorts
  for delete using (
    requesting_user_id() = user_id 
    or 
    (org_id is not null and org_id = requesting_org_id())
  );

-- Mice
drop policy "Users can view their own or org mice" on mice;
create policy "Users can view their own or org mice" on mice
  for select using (
    requesting_user_id() = user_id 
    or 
    (org_id is not null and org_id = requesting_org_id())
  );

drop policy "Users can insert their own or org mice" on mice;
create policy "Users can insert their own or org mice" on mice
  for insert with check (
    requesting_user_id() = user_id 
    or 
    (org_id is not null and org_id = requesting_org_id())
  );

drop policy "Users can update their own or org mice" on mice;
create policy "Users can update their own or org mice" on mice
  for update using (
    requesting_user_id() = user_id 
    or 
    (org_id is not null and org_id = requesting_org_id())
  );

drop policy "Users can delete their own or org mice" on mice;
create policy "Users can delete their own or org mice" on mice
  for delete using (
    requesting_user_id() = user_id 
    or 
    (org_id is not null and org_id = requesting_org_id())
  );

-- Logs
drop policy "Users can view logs for their mice" on estrus_logs;
create policy "Users can view logs for their mice" on estrus_logs
  for select using (
    exists (
      select 1 from mice 
      where mice.id = estrus_logs.mouse_id 
      and (
        mice.user_id = requesting_user_id()
        or 
        (mice.org_id is not null and mice.org_id = requesting_org_id())
      )
    )
  );

drop policy "Users can insert logs for their mice" on estrus_logs;
create policy "Users can insert logs for their mice" on estrus_logs
  for insert with check (
    exists (
      select 1 from mice 
      where mice.id = estrus_logs.mouse_id 
      and (
        mice.user_id = requesting_user_id()
        or 
        (mice.org_id is not null and mice.org_id = requesting_org_id())
      )
    )
  );

