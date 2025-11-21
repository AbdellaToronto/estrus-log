-- Note: Using gen_random_uuid() which is built-in to Postgres (no extension needed)

-- Users Table (Synced from Clerk)
create table users (
  id text primary key, -- Matches Clerk User ID
  email text not null,
  full_name text,
  avatar_url text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Cohorts Table
create table cohorts (
  id uuid primary key default gen_random_uuid(),
  user_id text references users(id) on delete cascade not null,
  name text not null,
  description text,
  color text default 'bg-blue-500',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Mice Table
create table mice (
  id uuid primary key default gen_random_uuid(),
  user_id text references users(id) on delete cascade not null,
  cohort_id uuid references cohorts(id) on delete set null,
  name text not null,
  dob date,
  notes text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Estrus Logs Table
create table estrus_logs (
  id uuid primary key default gen_random_uuid(),
  mouse_id uuid references mice(id) on delete cascade not null,
  stage text not null, -- Proestrus, Estrus, Metestrus, Diestrus
  confidence jsonb, -- Stores the scores for each stage
  features jsonb, -- Stores the analyzed features (swelling, color, etc)
  image_url text,
  notes text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS Policies (Simple: Users can only see/edit their own data)
alter table users enable row level security;
alter table cohorts enable row level security;
alter table mice enable row level security;
alter table estrus_logs enable row level security;

create policy "Users can view their own profile" on users
  for select using (auth.uid()::text = id);

-- Service role can manage all users (for webhooks)
-- No insert/update policy needed for authenticated users as they don't manage their own user record directly in this table

create policy "Users can view their own cohorts" on cohorts
  for select using (auth.uid()::text = user_id);

create policy "Users can insert their own cohorts" on cohorts
  for insert with check (auth.uid()::text = user_id);

create policy "Users can update their own cohorts" on cohorts
  for update using (auth.uid()::text = user_id);

create policy "Users can delete their own cohorts" on cohorts
  for delete using (auth.uid()::text = user_id);

create policy "Users can view their own mice" on mice
  for select using (auth.uid()::text = user_id);

create policy "Users can insert their own mice" on mice
  for insert with check (auth.uid()::text = user_id);

create policy "Users can update their own mice" on mice
  for update using (auth.uid()::text = user_id);

create policy "Users can delete their own mice" on mice
  for delete using (auth.uid()::text = user_id);

-- Logs are accessible if the user owns the mouse
create policy "Users can view logs for their mice" on estrus_logs
  for select using (
    exists (select 1 from mice where mice.id = estrus_logs.mouse_id and mice.user_id = auth.uid()::text)
  );

create policy "Users can insert logs for their mice" on estrus_logs
  for insert with check (
    exists (select 1 from mice where mice.id = estrus_logs.mouse_id and mice.user_id = auth.uid()::text)
  );
