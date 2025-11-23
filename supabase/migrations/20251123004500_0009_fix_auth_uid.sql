-- Helper function to get the current user ID from the JWT
-- This extracts the 'sub' claim which is the Clerk User ID (e.g. "user_2...")
-- We need this because auth.uid() returns a UUID, and Clerk IDs are not UUIDs.
create or replace function requesting_user_id()
returns text as $$
  select nullif(auth.jwt()->>'sub', '')::text;
$$ language sql stable;

-- Update Policies for Experiments
drop policy if exists "Users can view their own or org experiments" on experiments;
create policy "Users can view their own or org experiments" on experiments
  for select using (
    requesting_user_id() = user_id 
    or 
    (org_id is not null and org_id = requesting_org_id())
  );

drop policy if exists "Users can insert their own or org experiments" on experiments;
create policy "Users can insert their own or org experiments" on experiments
  for insert with check (
    requesting_user_id() = user_id 
    or 
    (org_id is not null and org_id = requesting_org_id())
  );

drop policy if exists "Users can update their own or org experiments" on experiments;
create policy "Users can update their own or org experiments" on experiments
  for update using (
    requesting_user_id() = user_id 
    or 
    (org_id is not null and org_id = requesting_org_id())
  );

drop policy if exists "Users can delete their own or org experiments" on experiments;
create policy "Users can delete their own or org experiments" on experiments
  for delete using (
    requesting_user_id() = user_id 
    or 
    (org_id is not null and org_id = requesting_org_id())
  );

-- Update Policies for Experiment Cohorts
drop policy if exists "Users can view cohorts in their experiments" on experiment_cohorts;
create policy "Users can view cohorts in their experiments" on experiment_cohorts
  for select using (
    exists (
      select 1 from experiments
      where experiments.id = experiment_cohorts.experiment_id
      and (
        experiments.user_id = requesting_user_id()
        or
        (experiments.org_id is not null and experiments.org_id = requesting_org_id())
      )
    )
  );

drop policy if exists "Users can manage cohorts in their experiments" on experiment_cohorts;
create policy "Users can manage cohorts in their experiments" on experiment_cohorts
  for all using (
    exists (
      select 1 from experiments
      where experiments.id = experiment_cohorts.experiment_id
      and (
        experiments.user_id = requesting_user_id()
        or
        (experiments.org_id is not null and experiments.org_id = requesting_org_id())
      )
    )
  );
