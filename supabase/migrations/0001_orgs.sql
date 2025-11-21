-- Add org_id to cohorts and mice
alter table cohorts add column org_id text;
alter table mice add column org_id text;

-- Helper function to get the current organization ID from the JWT
create or replace function requesting_org_id()
returns text as $$
  select nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'org_id', '')::text;
$$ language sql stable;

-- Update RLS Policies for Cohorts

drop policy "Users can view their own cohorts" on cohorts;
create policy "Users can view their own or org cohorts" on cohorts
  for select using (
    auth.uid()::text = user_id 
    or 
    (org_id is not null and org_id = requesting_org_id())
  );

drop policy "Users can insert their own cohorts" on cohorts;
create policy "Users can insert their own or org cohorts" on cohorts
  for insert with check (
    auth.uid()::text = user_id 
    or 
    (org_id is not null and org_id = requesting_org_id())
  );

drop policy "Users can update their own cohorts" on cohorts;
create policy "Users can update their own or org cohorts" on cohorts
  for update using (
    auth.uid()::text = user_id 
    or 
    (org_id is not null and org_id = requesting_org_id())
  );

drop policy "Users can delete their own cohorts" on cohorts;
create policy "Users can delete their own or org cohorts" on cohorts
  for delete using (
    auth.uid()::text = user_id 
    or 
    (org_id is not null and org_id = requesting_org_id())
  );

-- Update RLS Policies for Mice

drop policy "Users can view their own mice" on mice;
create policy "Users can view their own or org mice" on mice
  for select using (
    auth.uid()::text = user_id 
    or 
    (org_id is not null and org_id = requesting_org_id())
  );

drop policy "Users can insert their own mice" on mice;
create policy "Users can insert their own or org mice" on mice
  for insert with check (
    auth.uid()::text = user_id 
    or 
    (org_id is not null and org_id = requesting_org_id())
  );

drop policy "Users can update their own mice" on mice;
create policy "Users can update their own or org mice" on mice
  for update using (
    auth.uid()::text = user_id 
    or 
    (org_id is not null and org_id = requesting_org_id())
  );

drop policy "Users can delete their own mice" on mice;
create policy "Users can delete their own or org mice" on mice
  for delete using (
    auth.uid()::text = user_id 
    or 
    (org_id is not null and org_id = requesting_org_id())
  );

-- Update RLS Policies for Logs (Indirect access via Mice)

drop policy "Users can view logs for their mice" on estrus_logs;
create policy "Users can view logs for their mice" on estrus_logs
  for select using (
    exists (
      select 1 from mice 
      where mice.id = estrus_logs.mouse_id 
      and (
        mice.user_id = auth.uid()::text 
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
        mice.user_id = auth.uid()::text 
        or 
        (mice.org_id is not null and mice.org_id = requesting_org_id())
      )
    )
  );
