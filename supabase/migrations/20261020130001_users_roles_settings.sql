-- Purpose: what the Users, Roles, Settings and Audit log screens need.
--   - audit_log.reason: the reason given for a change, stored by the audit trigger
--   - profiles.last_seen_at: when the person last opened a page (updated at most hourly)
--   - cohorts.notes and cohorts.is_archived; a cohort in use cannot be deleted
--   - an inactive profile has no rights at all, whatever its role
--   - the last active admin cannot be demoted or paused, by any route
--   - three functions the app calls, each recording the change reason:
--     trainer_update_profiles, admin_set_role, admin_update_setting
-- Tables touched: audit_log, profiles, cohorts (columns, triggers, policies, grants).
-- Prompt: 04 (users, roles, settings, audit log).

-- Tables -------------------------------------------------------------------

alter table public.audit_log add column reason text;

comment on column public.audit_log.reason is
  'Why the change was made, as typed by the person. Required for role and setting changes.';

alter table public.profiles add column last_seen_at timestamptz;

comment on column public.profiles.last_seen_at is
  'When the person last opened a page. Updated at most once an hour; not audited.';

alter table public.cohorts
  add column notes text,
  add column is_archived boolean not null default false;

comment on column public.cohorts.is_archived is
  'Archived cohorts stay on record but cannot take new people.';

-- A cohort that anyone is in cannot be deleted; archive it instead.
alter table public.profiles drop constraint profiles_cohort_id_fkey;
alter table public.profiles
  add constraint profiles_cohort_id_fkey
  foreign key (cohort_id) references public.cohorts (id) on delete restrict;

-- Functions ----------------------------------------------------------------

-- current_app_role() and has_role() already return no role for an inactive
-- profile (migration 3). can_view_user() let an inactive person see their own
-- row; now an inactive viewer sees nobody, themselves included.
create or replace function public.can_view_user(target uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  viewer_id uuid := (select auth.uid());
  viewer_role public.app_role;
  viewer_scope public.progress_scope_type;
  viewer_department uuid;
begin
  if viewer_id is null or target is null then
    return false;
  end if;

  select p.role, p.progress_scope, p.department_id
    into viewer_role, viewer_scope, viewer_department
  from public.profiles p
  where p.id = viewer_id
    and p.is_active;

  if not found then
    return false;
  end if;

  if target = viewer_id then
    return true;
  end if;

  if viewer_role in ('trainer', 'admin') or viewer_scope = 'all' then
    return true;
  end if;

  if viewer_scope = 'department' and viewer_department is not null then
    return exists (
      with recursive scope_departments as (
        select d.id
        from public.departments d
        where d.id = viewer_department
        union
        select child.id
        from public.departments child
        join scope_departments parent on child.parent_id = parent.id
      )
      select 1
      from public.profiles t
      where t.id = target
        and t.department_id in (select s.id from scope_departments s)
    );
  end if;

  return false;
end;
$$;

comment on function public.can_view_user(uuid) is
  'Progress scope check for an active viewer: self; department scope sees own and child departments; all scope, trainers and admins see everyone. Inactive viewers see nobody.';

-- The app needs to tell a paused person apart from someone with no profile,
-- without giving the paused person any read rights.
create function public.my_access_status()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when (select auth.uid()) is null then 'signed_out'
    when p.id is null then 'no_profile'
    when p.is_active then 'active'
    else 'paused'
  end
  from (select 1) as one
  left join public.profiles p on p.id = (select auth.uid());
$$;

comment on function public.my_access_status() is
  'For the signed-in person only: active, paused, no_profile or signed_out. Reveals nothing about anyone else.';

create or replace function public.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  before_row jsonb;
  after_row jsonb;
  ignored text[] := array['updated_at', 'last_seen_at'];
begin
  if tg_op in ('UPDATE', 'DELETE') then
    before_row := to_jsonb(old);
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    after_row := to_jsonb(new);
  end if;

  if tg_op = 'UPDATE' and (before_row - ignored) = (after_row - ignored) then
    return new;
  end if;

  insert into public.audit_log (actor_id, action, table_name, row_id, before, after, reason)
  values (
    (select auth.uid()),
    lower(tg_op),
    tg_table_name,
    coalesce((after_row ->> 'id'), (before_row ->> 'id'))::uuid,
    before_row,
    after_row,
    nullif(btrim(current_setting('app.change_reason', true)), '')
  );

  return coalesce(new, old);
end;
$$;

comment on function public.audit_row_change() is
  'Trigger: writes one audit_log row per insert, update or delete, with the reason set in app.change_reason. Skips updates that change only updated_at or last_seen_at.';

-- Same rules as migration 3, plus: a trainer cannot pause or restore an admin.
create or replace function public.protect_profile_privileges()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  actor_role public.app_role;
begin
  if actor_id is null then
    return new;
  end if;

  actor_role := public.current_app_role();

  if tg_op = 'INSERT' then
    if actor_role is distinct from 'admin'
       and (new.role <> 'learner' or new.progress_scope <> 'self') then
      raise exception 'Only an admin can create a profile with a role or progress scope other than the defaults.'
        using errcode = '42501';
    end if;
    return new;
  end if;

  if new.id is distinct from old.id or new.email is distinct from old.email then
    raise exception 'A profile''s login id and email cannot be changed here.'
      using errcode = '42501';
  end if;

  if actor_role = 'admin' then
    return new;
  end if;

  if new.role is distinct from old.role
     or new.progress_scope is distinct from old.progress_scope then
    raise exception 'Only an admin can change a role or progress scope.'
      using errcode = '42501';
  end if;

  if (new.department_id, new.stream, new.specialist_pathway, new.cohort_id, new.is_active)
     is distinct from
     (old.department_id, old.stream, old.specialist_pathway, old.cohort_id, old.is_active)
     and actor_role is distinct from 'trainer' then
    raise exception 'Only a trainer or admin can change department, stream, pathway, cohort or active status.'
      using errcode = '42501';
  end if;

  if old.role = 'admin' and new.is_active is distinct from old.is_active then
    raise exception 'Only an admin can pause or restore an admin''s access.'
      using errcode = '42501';
  end if;

  if new.full_name is distinct from old.full_name and old.id <> actor_id then
    raise exception 'You can change only your own name.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

comment on function public.protect_profile_privileges() is
  'Trigger: only admins change role or progress scope, or pause an admin; trainers change department, stream, pathway, cohort, active; everyone else only their own name.';

-- Applies to every route, the SQL editor included, so the platform is never
-- left without an admin. The advisory lock stops two admins demoting each
-- other at the same moment.
create function public.protect_last_admin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.role = 'admin' and old.is_active
     and (new.role is distinct from 'admin' or not new.is_active) then
    perform pg_advisory_xact_lock(hashtext('public.profiles.last_admin'));
    if not exists (
      select 1 from public.profiles p
      where p.role = 'admin' and p.is_active and p.id <> old.id
    ) then
      raise exception 'This would leave no active admin. Make someone else an admin first.'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

comment on function public.protect_last_admin() is
  'Trigger: refuses any change that would leave no active admin.';

-- Called by the app on page load. Changes only the caller's own row, and only
-- when the last value is more than an hour old.
create function public.record_last_seen()
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  update public.profiles p
  set last_seen_at = now()
  where p.id = (select auth.uid())
    and p.is_active
    and (p.last_seen_at is null or p.last_seen_at < now() - interval '1 hour');
$$;

comment on function public.record_last_seen() is
  'Sets the caller''s last_seen_at to now, at most once an hour.';

-- Runs as the caller, so row-level security and the profile guards still apply.
-- A null argument means "leave unchanged"; clear_fields lists fields to empty
-- (department, stream, specialist_pathway, cohort). All or nothing.
create function public.trainer_update_profiles(
  user_ids uuid[],
  department_id uuid default null,
  stream public.stream_type default null,
  specialist_pathway public.specialist_pathway_type default null,
  cohort_id uuid default null,
  is_active boolean default null,
  reason text default null,
  clear_fields text[] default '{}'
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  clean_reason text := nullif(btrim(trainer_update_profiles.reason), '');
  clears text[] := coalesce(trainer_update_profiles.clear_fields, '{}');
  wanted integer;
  changed integer;
begin
  if not public.has_role('trainer', 'admin') then
    raise exception 'Only a trainer or admin can update people.'
      using errcode = '42501';
  end if;

  select count(distinct u) into wanted
  from unnest(coalesce(trainer_update_profiles.user_ids, '{}')) as u;
  if wanted = 0 then
    raise exception 'Choose at least one person.' using errcode = '22023';
  end if;

  if not clears <@ array['department', 'stream', 'specialist_pathway', 'cohort'] then
    raise exception 'Only department, stream, specialist pathway and cohort can be cleared.'
      using errcode = '22023';
  end if;

  if trainer_update_profiles.department_id is null
     and trainer_update_profiles.stream is null
     and trainer_update_profiles.specialist_pathway is null
     and trainer_update_profiles.cohort_id is null
     and trainer_update_profiles.is_active is null
     and cardinality(clears) = 0 then
    raise exception 'Nothing to change.' using errcode = '22023';
  end if;

  if trainer_update_profiles.department_id is not null and not exists (
    select 1 from public.departments d
    where d.id = trainer_update_profiles.department_id and d.is_active
  ) then
    raise exception 'That department does not exist or is not active.' using errcode = '22023';
  end if;

  if trainer_update_profiles.cohort_id is not null and not exists (
    select 1 from public.cohorts c
    where c.id = trainer_update_profiles.cohort_id and not c.is_archived
  ) then
    raise exception 'That cohort does not exist or is archived.' using errcode = '22023';
  end if;

  if trainer_update_profiles.is_active = false
     and (select auth.uid()) = any (trainer_update_profiles.user_ids) then
    raise exception 'You cannot pause your own access.' using errcode = '42501';
  end if;

  if char_length(coalesce(clean_reason, '')) > 500 then
    raise exception 'Keep the reason under 500 characters.' using errcode = '22023';
  end if;

  perform set_config('app.change_reason', coalesce(clean_reason, ''), true);

  update public.profiles p
  set
    department_id = case
      when 'department' = any (clears) then null
      else coalesce(trainer_update_profiles.department_id, p.department_id)
    end,
    stream = case
      when 'stream' = any (clears) then null
      else coalesce(trainer_update_profiles.stream, p.stream)
    end,
    specialist_pathway = case
      when 'specialist_pathway' = any (clears) then null
      else coalesce(trainer_update_profiles.specialist_pathway, p.specialist_pathway)
    end,
    cohort_id = case
      when 'cohort' = any (clears) then null
      else coalesce(trainer_update_profiles.cohort_id, p.cohort_id)
    end,
    is_active = coalesce(trainer_update_profiles.is_active, p.is_active)
  where p.id = any (trainer_update_profiles.user_ids);

  get diagnostics changed = row_count;

  perform set_config('app.change_reason', '', true);

  if changed <> wanted then
    raise exception 'Some of those people could not be found. Nothing was changed.'
      using errcode = '42501';
  end if;

  return changed;
end;
$$;

comment on function public.trainer_update_profiles(uuid[], uuid, public.stream_type, public.specialist_pathway_type, uuid, boolean, text, text[]) is
  'Trainer or admin: set department, stream, specialist pathway, cohort or active for one or many people. Cannot change role or progress scope.';

create function public.admin_set_role(
  user_id uuid,
  new_role public.app_role,
  new_scope public.progress_scope_type,
  reason text
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  clean_reason text := btrim(coalesce(admin_set_role.reason, ''));
  current_role_value public.app_role;
  current_scope public.progress_scope_type;
  current_active boolean;
begin
  if not public.has_role('admin') then
    raise exception 'Only an admin can change a role.' using errcode = '42501';
  end if;

  if char_length(clean_reason) < 10 then
    raise exception 'Give a reason of at least 10 characters.' using errcode = '22023';
  end if;
  if char_length(clean_reason) > 500 then
    raise exception 'Keep the reason under 500 characters.' using errcode = '22023';
  end if;

  if admin_set_role.new_role is null or admin_set_role.new_scope is null then
    raise exception 'Choose a role and a progress scope.' using errcode = '22023';
  end if;

  select p.role, p.progress_scope, p.is_active
    into current_role_value, current_scope, current_active
  from public.profiles p
  where p.id = admin_set_role.user_id;

  if not found then
    raise exception 'That person was not found.' using errcode = '22023';
  end if;

  if current_role_value = admin_set_role.new_role and current_scope = admin_set_role.new_scope then
    raise exception 'That person already has this role and progress scope.' using errcode = '22023';
  end if;

  if current_role_value = 'admin' and current_active and admin_set_role.new_role <> 'admin'
     and not exists (
       select 1 from public.profiles p
       where p.role = 'admin' and p.is_active and p.id <> admin_set_role.user_id
     ) then
    if admin_set_role.user_id = (select auth.uid()) then
      raise exception 'You are the only active admin. Make someone else an admin before you change your own role.'
        using errcode = '42501';
    end if;
    raise exception 'This would leave no active admin. Make someone else an admin first.'
      using errcode = '42501';
  end if;

  perform set_config('app.change_reason', clean_reason, true);

  update public.profiles p
  set role = admin_set_role.new_role,
      progress_scope = admin_set_role.new_scope
  where p.id = admin_set_role.user_id;

  perform set_config('app.change_reason', '', true);
end;
$$;

comment on function public.admin_set_role(uuid, public.app_role, public.progress_scope_type, text) is
  'Admin only: set a person''s role and progress scope, with a reason of at least 10 characters. Never leaves the platform without an active admin.';

create function public.admin_update_setting(
  key text,
  new_value jsonb,
  reason text
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  clean_reason text := btrim(coalesce(admin_update_setting.reason, ''));
begin
  if not public.has_role('admin') then
    raise exception 'Only an admin can change a setting.' using errcode = '42501';
  end if;

  if char_length(clean_reason) < 10 then
    raise exception 'Give a reason of at least 10 characters.' using errcode = '22023';
  end if;
  if char_length(clean_reason) > 500 then
    raise exception 'Keep the reason under 500 characters.' using errcode = '22023';
  end if;

  if admin_update_setting.new_value is null then
    raise exception 'The new value is empty.' using errcode = '22023';
  end if;

  perform set_config('app.change_reason', clean_reason, true);

  update public.app_settings s
  set value = admin_update_setting.new_value
  where s.key = admin_update_setting.key;

  if not found then
    raise exception 'That setting does not exist.' using errcode = '22023';
  end if;

  perform set_config('app.change_reason', '', true);
end;
$$;

comment on function public.admin_update_setting(text, jsonb, text) is
  'Admin only: replace a setting''s value, with a reason of at least 10 characters. The app checks the shape first.';

-- Function access ------------------------------------------------------------

revoke execute on function public.my_access_status() from public, anon;
revoke execute on function public.record_last_seen() from public, anon;
revoke execute on function public.trainer_update_profiles(uuid[], uuid, public.stream_type, public.specialist_pathway_type, uuid, boolean, text, text[]) from public, anon;
revoke execute on function public.admin_set_role(uuid, public.app_role, public.progress_scope_type, text) from public, anon;
revoke execute on function public.admin_update_setting(text, jsonb, text) from public, anon;
revoke execute on function public.protect_last_admin() from public, anon, authenticated;

grant execute on function public.my_access_status() to authenticated;
grant execute on function public.record_last_seen() to authenticated;
grant execute on function public.trainer_update_profiles(uuid[], uuid, public.stream_type, public.specialist_pathway_type, uuid, boolean, text, text[]) to authenticated;
grant execute on function public.admin_set_role(uuid, public.app_role, public.progress_scope_type, text) to authenticated;
grant execute on function public.admin_update_setting(text, jsonb, text) to authenticated;

-- Triggers -----------------------------------------------------------------

-- Named to run after profiles_protect_privileges (triggers fire in name order),
-- so a missing right is reported before the last-admin rule.
create trigger profiles_protect_sole_admin before update on public.profiles
  for each row execute function public.protect_last_admin();

create trigger cohorts_audit after insert or update or delete on public.cohorts
  for each row execute function public.audit_row_change();

-- Table access -------------------------------------------------------------
-- Signed-in people may update only these profile columns; the guards above
-- decide who may change which. last_seen_at changes only through
-- record_last_seen(); email, id and timestamps never change through the API.

revoke update on table public.profiles from authenticated;
grant update (full_name, department_id, role, progress_scope, stream, specialist_pathway, cohort_id, is_active)
  on table public.profiles to authenticated;

-- Row-level security -------------------------------------------------------
-- Cohorts already have "staff read; trainer and admin write" (migration 6).
-- The two self-service policies now also need an active profile.

drop policy "people change own profile, trainers and admins change any" on public.profiles;
create policy "active people change own profile, trainers and admins change any" on public.profiles
  for update to authenticated
  using (
    (id = (select auth.uid()) and (select public.current_app_role()) is not null)
    or (select public.has_role('trainer', 'admin'))
  )
  with check (
    (id = (select auth.uid()) and (select public.current_app_role()) is not null)
    or (select public.has_role('trainer', 'admin'))
  );

drop policy "learners un-mark own lesson progress" on public.lesson_progress;
create policy "active learners un-mark own lesson progress" on public.lesson_progress
  for delete to authenticated
  using (user_id = (select auth.uid()) and (select public.current_app_role()) is not null);
