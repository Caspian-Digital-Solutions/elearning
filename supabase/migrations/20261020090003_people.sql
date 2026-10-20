-- Purpose: one profile per signed-in person (ARCHITECTURE 6.2), the helper
--   checks every RLS policy uses, and the guard that stops anyone except an
--   admin from changing a role or progress scope.
-- Tables touched: profiles (new); app_settings (foreign key and updated_by stamp).
-- Prompt: 02 (database foundation). Rows are created at first sign-in in Prompt 03.

-- Tables -------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique check (email = lower(email) and position('@' in email) > 1),
  full_name text,
  department_id uuid references public.departments (id) on delete set null,
  role public.app_role not null default 'learner',
  progress_scope public.progress_scope_type not null default 'self',
  stream public.stream_type,
  specialist_pathway public.specialist_pathway_type,
  cohort_id uuid references public.cohorts (id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is
  'One row per signed-in person. Role (what you can do) and progress scope (whose progress you see) are separate.';

alter table public.app_settings
  add constraint app_settings_updated_by_fkey
  foreign key (updated_by) references public.profiles (id) on delete set null;

-- Indexes ------------------------------------------------------------------

create index profiles_department_id_idx on public.profiles (department_id);
create index profiles_cohort_id_idx on public.profiles (cohort_id);

-- Functions ----------------------------------------------------------------

-- Helpers are security definer so policies can read profiles without the
-- profiles policies calling themselves. An inactive person has no role.

create function public.current_app_role()
returns public.app_role
language sql
stable
security definer
set search_path = ''
as $$
  select p.role
  from public.profiles p
  where p.id = (select auth.uid())
    and p.is_active;
$$;

comment on function public.current_app_role() is
  'Role of the signed-in person, or null if not signed in, without a profile, or inactive.';

create function public.has_role(variadic roles public.app_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.current_app_role() = any (roles), false);
$$;

comment on function public.has_role(public.app_role[]) is
  'True when the signed-in, active person has one of the given roles.';

create function public.can_view_user(target uuid)
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

  if target = viewer_id then
    return true;
  end if;

  select p.role, p.progress_scope, p.department_id
    into viewer_role, viewer_scope, viewer_department
  from public.profiles p
  where p.id = viewer_id
    and p.is_active;

  if not found then
    return false;
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
  'Progress scope check: self always; department scope sees own and child departments; all scope, trainers and admins see everyone.';

-- Trusted server contexts (SQL editor, secret-key scripts, sign-in trigger)
-- have no auth.uid() and are allowed through.
create function public.protect_profile_privileges()
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

  if new.full_name is distinct from old.full_name and old.id <> actor_id then
    raise exception 'You can change only your own name.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

comment on function public.protect_profile_privileges() is
  'Trigger: only admins change role or progress scope; trainers change department, stream, pathway, cohort, active; everyone else only their own name.';

create function public.set_updated_by()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_by := coalesce((select auth.uid()), new.updated_by);
  return new;
end;
$$;

comment on function public.set_updated_by() is
  'Trigger: records the signed-in person as updated_by. Trusted server jobs keep the value they supply.';

-- Triggers -----------------------------------------------------------------

create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger profiles_protect_privileges before insert or update on public.profiles
  for each row execute function public.protect_profile_privileges();

create trigger app_settings_set_updated_by before insert or update on public.app_settings
  for each row execute function public.set_updated_by();

-- Function access: helpers are for signed-in people; triggers are never called directly.

revoke execute on function public.current_app_role() from public, anon;
revoke execute on function public.has_role(public.app_role[]) from public, anon;
revoke execute on function public.can_view_user(uuid) from public, anon;
grant execute on function public.current_app_role() to authenticated, service_role;
grant execute on function public.has_role(public.app_role[]) to authenticated, service_role;
grant execute on function public.can_view_user(uuid) to authenticated, service_role;

revoke execute on function public.protect_profile_privileges() from public, anon, authenticated;
revoke execute on function public.set_updated_by() from public, anon, authenticated;

-- Row-level security (policies in migration 6) ------------------------------

alter table public.profiles enable row level security;
