create table if not exists scan_sessions (
  id uuid default gen_random_uuid() primary key,
  cohort_id uuid references cohorts(id) on delete cascade,
  user_id text not null,
  name text,
  status text default 'pending', -- pending, processing, review, completed
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists scan_items (
  id uuid default gen_random_uuid() primary key,
  session_id uuid references scan_sessions(id) on delete cascade,
  image_url text not null,
  status text default 'pending', -- pending, uploaded, analyzing, complete, error
  ai_result jsonb,
  mouse_id uuid references mice(id) on delete set null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS
alter table scan_sessions enable row level security;
alter table scan_items enable row level security;

create policy "Users can view their own sessions"
  on scan_sessions for select
  using (auth.uid()::text = user_id);

create policy "Users can insert their own sessions"
  on scan_sessions for insert
  with check (auth.uid()::text = user_id);

create policy "Users can update their own sessions"
  on scan_sessions for update
  using (auth.uid()::text = user_id);

create policy "Users can view items in their sessions"
  on scan_items for select
  using (
    exists (
      select 1 from scan_sessions
      where scan_sessions.id = scan_items.session_id
      and scan_sessions.user_id = auth.uid()::text
    )
  );

create policy "Users can insert items in their sessions"
  on scan_items for insert
  with check (
    exists (
      select 1 from scan_sessions
      where scan_sessions.id = scan_items.session_id
      and scan_sessions.user_id = auth.uid()::text
    )
  );

create policy "Users can update items in their sessions"
  on scan_items for update
  using (
    exists (
      select 1 from scan_sessions
      where scan_sessions.id = scan_items.session_id
      and scan_sessions.user_id = auth.uid()::text
    )
  );

