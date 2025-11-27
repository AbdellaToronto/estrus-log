-- Enable the pgvector extension to work with embedding vectors
create extension if not exists vector;

-- Create a table to store reference images and their embeddings
create table if not exists reference_images (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  embedding vector(512),
  image_path text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

-- Enable Row Level Security (RLS)
alter table reference_images enable row level security;

-- Allow read access to everyone (authenticated and anonymous)
create policy "Enable read access for all users" 
on reference_images for select 
using (true);

-- Allow insert/update/delete only for service role (handled by backend/scripts)
-- Note: Service role bypasses RLS, so we don't strictly need policies for it, 
-- but good to be explicit if we ever use authenticated users to upload.
create policy "Enable write access for authenticated users" 
on reference_images for all 
to authenticated 
using (true) 
with check (true);

-- Create a function to find similar images
create or replace function match_reference_images (
  query_embedding vector(512),
  match_threshold float,
  match_count int
)
returns table (
  id uuid,
  label text,
  similarity float,
  image_path text,
  metadata jsonb
)
language plpgsql
as $$
begin
  return query
  select
    reference_images.id,
    reference_images.label,
    1 - (reference_images.embedding <=> query_embedding) as similarity,
    reference_images.image_path,
    reference_images.metadata
  from reference_images
  where 1 - (reference_images.embedding <=> query_embedding) > match_threshold
  order by reference_images.embedding <=> query_embedding
  limit match_count;
end;
$$;






