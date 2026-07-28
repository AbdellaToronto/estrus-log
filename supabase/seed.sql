-- Fixed identity for the isolated `pnpm dev:rehearsal` scientist journey.
-- No cohort, subject, or observation is seeded: those records are deliberately
-- created through the real UI during the rehearsal.
insert into public.users (id, email, full_name, avatar_url)
values (
  'user_local_scientist',
  'scientist@estrus.local',
  'Local Scientist',
  null
)
on conflict (id) do update set
  email = excluded.email,
  full_name = excluded.full_name;

insert into public.organization_profiles (
  clerk_org_id,
  is_discoverable,
  institution,
  department,
  description
)
values (
  'org_local_estrus_lab',
  false,
  'Local research environment',
  'Estrus Lab',
  'Isolated scientist workflow rehearsal data.'
)
on conflict (clerk_org_id) do update set
  institution = excluded.institution,
  department = excluded.department,
  description = excluded.description;
