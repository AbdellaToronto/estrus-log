-- Create experiments table
create table if not exists experiments (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  description text,
  status text default 'planned', -- planned, active, completed, archived
  start_date date,
  end_date date,
  user_id text, -- links to auth.users
  org_id text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Create experiment_cohorts table (Many-to-Many)
create table if not exists experiment_cohorts (
  experiment_id uuid references experiments(id) on delete cascade,
  cohort_id uuid references cohorts(id) on delete cascade,
  assigned_at timestamptz default now(),
  primary key (experiment_id, cohort_id)
);

-- Enable RLS
alter table experiments enable row level security;
alter table experiment_cohorts enable row level security;

-- RLS Policies for Experiments
create policy "Users can view their own or org experiments" on experiments
  for select using (
    auth.uid()::text = user_id 
    or 
    (org_id is not null and org_id = requesting_org_id())
  );

create policy "Users can insert their own or org experiments" on experiments
  for insert with check (
    auth.uid()::text = user_id 
    or 
    (org_id is not null and org_id = requesting_org_id())
  );

create policy "Users can update their own or org experiments" on experiments
  for update using (
    auth.uid()::text = user_id 
    or 
    (org_id is not null and org_id = requesting_org_id())
  );

create policy "Users can delete their own or org experiments" on experiments
  for delete using (
    auth.uid()::text = user_id 
    or 
    (org_id is not null and org_id = requesting_org_id())
  );

-- RLS Policies for Experiment Cohorts
create policy "Users can view cohorts in their experiments" on experiment_cohorts
  for select using (
    exists (
      select 1 from experiments
      where experiments.id = experiment_cohorts.experiment_id
      and (
        experiments.user_id = auth.uid()::text
        or
        (experiments.org_id is not null and experiments.org_id = requesting_org_id())
      )
    )
  );

create policy "Users can manage cohorts in their experiments" on experiment_cohorts
  for all using (
    exists (
      select 1 from experiments
      where experiments.id = experiment_cohorts.experiment_id
      and (
        experiments.user_id = auth.uid()::text
        or
        (experiments.org_id is not null and experiments.org_id = requesting_org_id())
      )
    )
  );

