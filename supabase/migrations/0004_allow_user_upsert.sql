-- Allow users to self-register/upsert their own profile
-- This enables the backend to auto-sync users from Clerk if the webhook fails/delays

create policy "Users can insert their own profile" on users
  for insert with check (requesting_user_id() = id);

create policy "Users can update their own profile" on users
  for update using (requesting_user_id() = id);

