-- Clerk user IDs are text values (`user_...`), so auth.uid() cannot be used:
-- Supabase casts the JWT subject to UUID before returning it. The app's Clerk
-- third-party-auth integration exposes the subject and organization through
-- requesting_user_id() and requesting_org_id(), which were added in 0001/0002.

drop policy if exists "Users can view logs for their mice" on estrus_logs;
drop policy if exists "Users can insert logs for their mice" on estrus_logs;
drop policy if exists "Users can view logs in their cohorts or org" on estrus_logs;
drop policy if exists "Users can insert logs in their cohorts" on estrus_logs;
drop policy if exists "Users can update logs in their cohorts" on estrus_logs;
drop policy if exists "Users can delete logs in their cohorts" on estrus_logs;

create policy "Users can view logs in their cohorts or org"
  on estrus_logs for select
  using (
    exists (
      select 1
      from cohorts
      where cohorts.id = estrus_logs.cohort_id
        and (
          cohorts.user_id = requesting_user_id()
          or (
            cohorts.org_id is not null
            and cohorts.org_id = requesting_org_id()
          )
        )
    )
  );

create policy "Users can insert logs in their cohorts"
  on estrus_logs for insert
  with check (
    exists (
      select 1
      from cohorts
      where cohorts.id = estrus_logs.cohort_id
        and (
          cohorts.user_id = requesting_user_id()
          or (
            cohorts.org_id is not null
            and cohorts.org_id = requesting_org_id()
          )
        )
    )
  );

create policy "Users can update logs in their cohorts"
  on estrus_logs for update
  using (
    exists (
      select 1
      from cohorts
      where cohorts.id = estrus_logs.cohort_id
        and (
          cohorts.user_id = requesting_user_id()
          or (
            cohorts.org_id is not null
            and cohorts.org_id = requesting_org_id()
          )
        )
    )
  )
  with check (
    exists (
      select 1
      from cohorts
      where cohorts.id = estrus_logs.cohort_id
        and (
          cohorts.user_id = requesting_user_id()
          or (
            cohorts.org_id is not null
            and cohorts.org_id = requesting_org_id()
          )
        )
    )
  );

create policy "Users can delete logs in their cohorts"
  on estrus_logs for delete
  using (
    exists (
      select 1
      from cohorts
      where cohorts.id = estrus_logs.cohort_id
        and (
          cohorts.user_id = requesting_user_id()
          or (
            cohorts.org_id is not null
            and cohorts.org_id = requesting_org_id()
          )
        )
    )
  );

drop policy if exists "Users can view their own sessions" on scan_sessions;
drop policy if exists "Users can insert their own sessions" on scan_sessions;
drop policy if exists "Users can update their own sessions" on scan_sessions;
drop policy if exists "Users can delete their own sessions" on scan_sessions;

create policy "Users can view sessions in their cohorts or org"
  on scan_sessions for select
  using (
    exists (
      select 1
      from cohorts
      where cohorts.id = scan_sessions.cohort_id
        and (
          cohorts.user_id = requesting_user_id()
          or (
            cohorts.org_id is not null
            and cohorts.org_id = requesting_org_id()
          )
        )
    )
  );

create policy "Users can insert sessions in their cohorts"
  on scan_sessions for insert
  with check (
    user_id = requesting_user_id()
    and exists (
      select 1
      from cohorts
      where cohorts.id = scan_sessions.cohort_id
        and (
          cohorts.user_id = requesting_user_id()
          or (
            cohorts.org_id is not null
            and cohorts.org_id = requesting_org_id()
          )
        )
    )
  );

create policy "Users can update sessions in their cohorts"
  on scan_sessions for update
  using (
    exists (
      select 1
      from cohorts
      where cohorts.id = scan_sessions.cohort_id
        and (
          cohorts.user_id = requesting_user_id()
          or (
            cohorts.org_id is not null
            and cohorts.org_id = requesting_org_id()
          )
        )
    )
  )
  with check (
    exists (
      select 1
      from cohorts
      where cohorts.id = scan_sessions.cohort_id
        and (
          cohorts.user_id = requesting_user_id()
          or (
            cohorts.org_id is not null
            and cohorts.org_id = requesting_org_id()
          )
        )
    )
  );

create policy "Users can delete sessions in their cohorts"
  on scan_sessions for delete
  using (
    exists (
      select 1
      from cohorts
      where cohorts.id = scan_sessions.cohort_id
        and (
          cohorts.user_id = requesting_user_id()
          or (
            cohorts.org_id is not null
            and cohorts.org_id = requesting_org_id()
          )
        )
    )
  );

drop policy if exists "Users can view items in their sessions" on scan_items;
drop policy if exists "Users can insert items in their sessions" on scan_items;
drop policy if exists "Users can update items in their sessions" on scan_items;
drop policy if exists "Users can delete items in their sessions" on scan_items;

create policy "Users can view items in their sessions"
  on scan_items for select
  using (
    exists (
      select 1
      from scan_sessions
      join cohorts on cohorts.id = scan_sessions.cohort_id
      where scan_sessions.id = scan_items.session_id
        and (
          cohorts.user_id = requesting_user_id()
          or (
            cohorts.org_id is not null
            and cohorts.org_id = requesting_org_id()
          )
        )
    )
  );

create policy "Users can insert items in their sessions"
  on scan_items for insert
  with check (
    exists (
      select 1
      from scan_sessions
      join cohorts on cohorts.id = scan_sessions.cohort_id
      where scan_sessions.id = scan_items.session_id
        and (
          cohorts.user_id = requesting_user_id()
          or (
            cohorts.org_id is not null
            and cohorts.org_id = requesting_org_id()
          )
        )
    )
  );

create policy "Users can update items in their sessions"
  on scan_items for update
  using (
    exists (
      select 1
      from scan_sessions
      join cohorts on cohorts.id = scan_sessions.cohort_id
      where scan_sessions.id = scan_items.session_id
        and (
          cohorts.user_id = requesting_user_id()
          or (
            cohorts.org_id is not null
            and cohorts.org_id = requesting_org_id()
          )
        )
    )
  )
  with check (
    exists (
      select 1
      from scan_sessions
      join cohorts on cohorts.id = scan_sessions.cohort_id
      where scan_sessions.id = scan_items.session_id
        and (
          cohorts.user_id = requesting_user_id()
          or (
            cohorts.org_id is not null
            and cohorts.org_id = requesting_org_id()
          )
        )
    )
  );

create policy "Users can delete items in their sessions"
  on scan_items for delete
  using (
    exists (
      select 1
      from scan_sessions
      join cohorts on cohorts.id = scan_sessions.cohort_id
      where scan_sessions.id = scan_items.session_id
        and (
          cohorts.user_id = requesting_user_id()
          or (
            cohorts.org_id is not null
            and cohorts.org_id = requesting_org_id()
          )
        )
    )
  );
