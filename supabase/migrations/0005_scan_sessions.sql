-- Create Scan Sessions to track batch upload jobs
create table scan_sessions (
  id uuid primary key default gen_random_uuid(),
  cohort_id uuid references cohorts(id) on delete cascade not null,
  user_id text not null, -- Clerk User ID
  status text default 'pending', -- pending, processing, review, completed
  name text, -- Optional name for the batch
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create Scan Items for individual images within a session
create table scan_items (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references scan_sessions(id) on delete cascade not null,
  image_url text not null, -- GCS Path
  status text default 'pending', -- pending, processing, complete, error, rejected
  ai_result jsonb, -- Stores the full Gemini classification
  mouse_id uuid references mice(id), -- The matched mouse (can be null initially)
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS Policies
alter table scan_sessions enable row level security;
alter table scan_items enable row level security;

-- Sessions Policies
create policy "Users can view their own or org sessions" on scan_sessions
  for select using (
    user_id = requesting_user_id() 
    or 
    exists (select 1 from cohorts where cohorts.id = scan_sessions.cohort_id and cohorts.org_id = requesting_org_id())
  );

create policy "Users can insert sessions" on scan_sessions
  for insert with check (
    user_id = requesting_user_id()
  );

create policy "Users can update sessions" on scan_sessions
  for update using (
    user_id = requesting_user_id()
    or 
    exists (select 1 from cohorts where cohorts.id = scan_sessions.cohort_id and cohorts.org_id = requesting_org_id())
  );

-- Items Policies
create policy "Users can view items in their sessions" on scan_items
  for select using (
    exists (select 1 from scan_sessions where scan_sessions.id = scan_items.session_id and (
      scan_sessions.user_id = requesting_user_id() 
      or 
      exists (select 1 from cohorts where cohorts.id = scan_sessions.cohort_id and cohorts.org_id = requesting_org_id())
    ))
  );

create policy "Users can insert items" on scan_items
  for insert with check (
    exists (select 1 from scan_sessions where scan_sessions.id = scan_items.session_id and (
      scan_sessions.user_id = requesting_user_id()
      or 
      exists (select 1 from cohorts where cohorts.id = scan_sessions.cohort_id and cohorts.org_id = requesting_org_id())
    ))
  );

create policy "Users can update items" on scan_items
  for update using (
    exists (select 1 from scan_sessions where scan_sessions.id = scan_items.session_id)
  );

