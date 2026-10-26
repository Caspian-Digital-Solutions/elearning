-- Prompt 13: Skills catalogue, approvals, usage evidence.
-- Tables: skills, skill_versions, skill_approvals, skill_usage_logs; enums; RLS; workflow RPCs.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type public.skill_status as enum ('draft', 'in_review', 'approved', 'live', 'retired');
create type public.skill_usage_outcome as enum ('kept', 'edited', 'discarded');
create type public.skill_approver_role as enum ('department_head', 'trainer', 'governance');
create type public.skill_approval_decision as enum ('approved', 'changes_requested');

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.skills (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  display_name text not null,
  department_id uuid not null references public.departments (id) on delete restrict,
  owner_id uuid references public.profiles (id) on delete set null,
  description text not null default '' check (char_length(description) <= 1024),
  status public.skill_status not null default 'draft',
  current_version text not null default '0.0',
  review_version_id uuid,
  how_to_enable_md text not null default '',
  boundaries_md text not null default '',
  is_certification_skill boolean not null default false,
  live_since date,
  retired_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint skills_name_format check (
    name ~ '^[a-z0-9-]{1,64}$'
    and name !~ '(claude|anthropic)'
  )
);

comment on table public.skills is 'Catalogue entry for Claude Skills (instructions live in Claude).';

create table public.skill_versions (
  id uuid primary key default gen_random_uuid(),
  skill_id uuid not null references public.skills (id) on delete cascade,
  version text not null,
  changelog_md text not null default '',
  skill_md_text text not null default '' check (char_length(skill_md_text) <= 102400),
  test_cases_count integer not null default 0 check (test_cases_count >= 0),
  test_cases_passed integer not null default 0 check (test_cases_passed >= 0),
  tested_by uuid references public.profiles (id) on delete set null,
  tested_at timestamptz,
  test_notes_md text,
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (skill_id, version),
  check (test_cases_passed <= test_cases_count)
);

comment on table public.skill_versions is 'Reference copy of a Skill instructions file and test evidence.';

create table public.skill_approvals (
  id uuid primary key default gen_random_uuid(),
  skill_version_id uuid not null references public.skill_versions (id) on delete cascade,
  approver_id uuid not null references public.profiles (id) on delete restrict,
  approver_role public.skill_approver_role not null,
  decision public.skill_approval_decision not null,
  comment_md text not null default '',
  decided_at timestamptz not null default now(),
  unique (skill_version_id, approver_id, approver_role)
);

create table public.skill_usage_logs (
  id uuid primary key default gen_random_uuid(),
  skill_id uuid not null references public.skills (id) on delete cascade,
  skill_version text not null,
  user_id uuid not null references public.profiles (id) on delete cascade,
  used_on date not null default ((current_timestamp at time zone 'Asia/Kuala_Lumpur')::date),
  task text not null check (char_length(task) <= 200),
  outcome public.skill_usage_outcome not null,
  minutes_saved integer check (minutes_saved is null or minutes_saved >= 0),
  declaration boolean not null default false,
  created_at timestamptz not null default now()
);

create index skills_status_idx on public.skills (status);
create index skills_department_id_idx on public.skills (department_id);
create index skill_versions_skill_id_idx on public.skill_versions (skill_id);
create index skill_approvals_version_idx on public.skill_approvals (skill_version_id);
create index skill_usage_logs_skill_id_idx on public.skill_usage_logs (skill_id);
create index skill_usage_logs_user_id_idx on public.skill_usage_logs (user_id);

alter table public.skills
  add constraint skills_review_version_fkey
  foreign key (review_version_id) references public.skill_versions (id) on delete set null;

create trigger skills_set_updated_at before update on public.skills
  for each row execute function public.set_updated_at();

create trigger skills_audit_row_change after insert or update or delete on public.skills
  for each row execute function public.audit_row_change();

create trigger skill_versions_audit_row_change after insert or update or delete on public.skill_versions
  for each row execute function public.audit_row_change();

-- Manager-safe aggregates (no user ids or task text)
create view public.skill_usage_manager_counts as
select
  s.department_id,
  ul.skill_id,
  count(*)::bigint as usage_count,
  count(distinct ul.user_id)::bigint as distinct_users,
  count(distinct ul.used_on)::bigint as distinct_days
from public.skill_usage_logs ul
join public.skills s on s.id = ul.skill_id
group by s.department_id, ul.skill_id;

comment on view public.skill_usage_manager_counts is
  'Managers may read usage counts for their department only; no PII.';

insert into public.app_settings (key, value, note)
values (
  'skills.min_test_cases',
  '8'::jsonb,
  'PROPOSED: minimum test cases before a Skill version can be submitted for review.'
)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- Seed seven certification Skills (idempotent on name)
-- ---------------------------------------------------------------------------

insert into public.skills (
  name,
  display_name,
  department_id,
  description,
  boundaries_md,
  is_certification_skill,
  how_to_enable_md
)
select
  v.name,
  v.display_name,
  d.id,
  v.description,
  v.boundaries_md,
  true,
  v.how_to_enable_md
from (
  values
    (
      'brand-content-production',
      'Brand content production',
      'content',
      'Department certification Skill for Content: draft catalogue entry until owned and reviewed.',
      'Nothing publishes without editor + client approval; health/education claims verified.',
      E'1. Open Claude and go to **Settings → Skills**.\n2. Add the Skill using the instructions file your Champion shares.\n3. Turn it on for your workspace when your department lead confirms it is live.'
    ),
    (
      'creative-brief-builder',
      'Creative brief builder',
      'creative',
      'Department certification Skill for Creative: draft catalogue entry until owned and reviewed.',
      'Claude does not produce final visuals.',
      E'1. Open Claude and go to **Settings → Skills**.\n2. Add the Skill using the instructions file your Champion shares.\n3. Turn it on for your workspace when your department lead confirms it is live.'
    ),
    (
      'seo-aeo-monthly-insight',
      'SEO / AEO monthly insight',
      'performance-seo',
      'Department certification Skill for Performance SEO: draft catalogue entry until owned and reviewed.',
      'No figure not traceable to an export.',
      E'1. Open Claude and go to **Settings → Skills**.\n2. Add the Skill using the instructions file your Champion shares.\n3. Turn it on for your workspace when your department lead confirms it is live.'
    ),
    (
      'campaign-performance-insight',
      'Campaign performance insight',
      'performance-paid',
      'Department certification Skill for Performance Paid: draft catalogue entry until owned and reviewed.',
      'No AI account changes.',
      E'1. Open Claude and go to **Settings → Skills**.\n2. Add the Skill using the instructions file your Champion shares.\n3. Turn it on for your workspace when your department lead confirms it is live.'
    ),
    (
      'lead-funnel-analysis',
      'Lead funnel analysis',
      'performance-analytics',
      'Department certification Skill for Performance Analytics: draft catalogue entry until owned and reviewed.',
      'Maths in code, no health ratings.',
      E'1. Open Claude and go to **Settings → Skills**.\n2. Add the Skill using the instructions file your Champion shares.\n3. Turn it on for your workspace when your department lead confirms it is live.'
    ),
    (
      'client-meeting-intelligence',
      'Client meeting intelligence',
      'account-management',
      'Department certification Skill for Account Management: draft catalogue entry until owned and reviewed.',
      'AI never sends to clients; no confidential data outside approved tools.',
      E'1. Open Claude and go to **Settings → Skills**.\n2. Add the Skill using the instructions file your Champion shares.\n3. Turn it on for your workspace when your department lead confirms it is live.'
    ),
    (
      'strategic-decision-brief',
      'Strategic decision brief',
      'senior-management',
      'Department certification Skill for Senior Management: draft catalogue entry until owned and reviewed.',
      'Decisions stay with named people.',
      E'1. Open Claude and go to **Settings → Skills**.\n2. Add the Skill using the instructions file your Champion shares.\n3. Turn it on for your workspace when your department lead confirms it is live.'
    )
) as v(name, display_name, department_code, description, boundaries_md, how_to_enable_md)
join public.departments d on d.code = v.department_code
on conflict (name) do nothing;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create function public.skill_min_test_cases()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select (s.value #>> '{}')::integer from public.app_settings s where s.key = 'skills.min_test_cases'),
    8
  );
$$;

create function public.is_skill_department_head(p_department_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_active
      and p.role = 'manager'
      and p.department_id = p_department_id
  );
$$;

create function public.is_skill_department_champion(p_department_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_active
      and p.role = 'champion'
      and p.department_id = p_department_id
  );
$$;

create function public.can_read_skill_row(s public.skills)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select public.has_role('trainer', 'admin'))
    or s.owner_id = auth.uid()
    or s.status in ('approved', 'live', 'retired')
    or (
      s.status in ('draft', 'in_review')
      and (
        public.is_skill_department_champion(s.department_id)
        or public.is_skill_department_head(s.department_id)
      )
    );
$$;

create function public.validate_skill_version_md(p_skill_id uuid, p_skill_md_text text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  sk public.skills;
  fm_name text;
  fm_desc text;
begin
  select * into sk from public.skills where id = p_skill_id;
  if not found then
    raise exception 'Skill not found.' using errcode = '22023';
  end if;
  if left(btrim(p_skill_md_text), 3) = '---' then
    fm_name := (regexp_match(p_skill_md_text, E'name:[[:space:]]*([^\\r\\n]+)', 'i'))[1];
    fm_desc := (regexp_match(p_skill_md_text, E'description:[[:space:]]*([^\\r\\n]+)', 'i'))[1];
    if fm_name is not null and lower(trim(fm_name)) <> sk.name then
      raise exception 'Front-matter name must match the catalogue name (%).', sk.name using errcode = 'P0001';
    end if;
    if fm_desc is not null and trim(fm_desc) <> trim(sk.description) then
      raise exception 'Front-matter description must match the catalogue description.' using errcode = 'P0001';
    end if;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Workflow RPCs
-- ---------------------------------------------------------------------------

create function public.save_skill_version(
  p_skill_id uuid,
  p_version text,
  p_changelog_md text,
  p_skill_md_text text,
  p_test_cases_count integer,
  p_test_cases_passed integer,
  p_test_notes_md text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  sk public.skills;
  ver_id uuid;
begin
  if actor is null then
    raise exception 'Sign in required.' using errcode = '42501';
  end if;
  select * into sk from public.skills where id = p_skill_id for update;
  if not found then
    raise exception 'Skill not found.' using errcode = '22023';
  end if;

  if not (
    (select public.has_role('trainer', 'admin'))
    or (sk.owner_id = actor)
    or (
      public.is_skill_department_champion(sk.department_id)
      and sk.status in ('draft', 'live')
    )
  ) then
    raise exception 'You cannot edit this Skill.' using errcode = '42501';
  end if;

  if sk.status = 'retired' then
    raise exception 'Retired Skills cannot be edited.' using errcode = '22023';
  end if;

  if p_version is null or p_version !~ '^[0-9]+(\.[0-9]+)?$' then
    raise exception 'Version must look like 1.0 or 1.1.' using errcode = 'P0001';
  end if;

  perform public.validate_skill_version_md(p_skill_id, coalesce(p_skill_md_text, ''));

  insert into public.skill_versions (
    skill_id, version, changelog_md, skill_md_text,
    test_cases_count, test_cases_passed, tested_by, tested_at, test_notes_md, created_by
  )
  values (
    p_skill_id,
    p_version,
    coalesce(p_changelog_md, ''),
    coalesce(p_skill_md_text, ''),
    coalesce(p_test_cases_count, 0),
    coalesce(p_test_cases_passed, 0),
    actor,
    now(),
    nullif(btrim(p_test_notes_md), ''),
    actor
  )
  on conflict (skill_id, version) do update
  set
    changelog_md = excluded.changelog_md,
    skill_md_text = excluded.skill_md_text,
    test_cases_count = excluded.test_cases_count,
    test_cases_passed = excluded.test_cases_passed,
    tested_by = actor,
    tested_at = now(),
    test_notes_md = excluded.test_notes_md
  returning id into ver_id;

  if sk.status = 'draft' and sk.current_version = '0.0' then
    update public.skills set current_version = p_version, updated_at = now() where id = p_skill_id;
  end if;

  return ver_id;
end;
$$;

create function public.submit_skill_for_review(p_skill_version_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  ver public.skill_versions;
  sk public.skills;
  min_cases integer;
begin
  select * into ver from public.skill_versions where id = p_skill_version_id;
  if not found then
    raise exception 'Skill version not found.' using errcode = '22023';
  end if;
  select * into sk from public.skills where id = ver.skill_id for update;
  min_cases := public.skill_min_test_cases();

  if ver.test_cases_count < min_cases or ver.test_cases_passed < min_cases then
    raise exception 'Record at least % test cases and the same number passed.', min_cases using errcode = 'P0001';
  end if;

  if not (
    sk.owner_id = actor
    or public.is_skill_department_champion(sk.department_id)
    or (select public.has_role('trainer', 'admin'))
  ) then
    raise exception 'Only the owner or a department Champion can submit for review.' using errcode = '42501';
  end if;

  if sk.status = 'retired' then
    raise exception 'Retired Skills cannot be submitted.' using errcode = '22023';
  end if;

  if sk.status = 'live' and ver.version = sk.current_version then
    raise exception 'Submit a new version number for a live Skill.' using errcode = '22023';
  end if;

  delete from public.skill_approvals where skill_version_id = p_skill_version_id;

  update public.skills
  set
    review_version_id = p_skill_version_id,
    status = case when status = 'live' then 'live'::public.skill_status else 'in_review'::public.skill_status end,
    updated_at = now()
  where id = sk.id;
end;
$$;

create function public.decide_skill_approval(
  p_skill_version_id uuid,
  p_decision public.skill_approval_decision,
  p_comment_md text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  ver public.skill_versions;
  sk public.skills;
  role public.skill_approver_role;
  head_ok boolean;
  trainer_ok boolean;
begin
  select * into ver from public.skill_versions where id = p_skill_version_id;
  if not found then
    raise exception 'Skill version not found.' using errcode = '22023';
  end if;
  select * into sk from public.skills where id = ver.skill_id for update;

  if sk.review_version_id is distinct from p_skill_version_id then
    raise exception 'This version is not awaiting review.' using errcode = '22023';
  end if;

  if (select public.has_role('trainer', 'admin')) then
    role := 'trainer';
  elsif public.is_skill_department_head(sk.department_id) then
    role := 'department_head';
  else
    raise exception 'You cannot approve this Skill.' using errcode = '42501';
  end if;

  if p_comment_md is null or length(trim(p_comment_md)) < 5 then
    raise exception 'Add a comment of at least five characters.' using errcode = 'P0001';
  end if;

  insert into public.skill_approvals (skill_version_id, approver_id, approver_role, decision, comment_md)
  values (p_skill_version_id, actor, role, p_decision, left(trim(p_comment_md), 4000))
  on conflict (skill_version_id, approver_id, approver_role) do update
  set decision = excluded.decision, comment_md = excluded.comment_md, decided_at = now();

  if p_decision = 'changes_requested' then
    update public.skills
    set
      status = case when status = 'live' then 'live'::public.skill_status else 'draft'::public.skill_status end,
      review_version_id = null,
      updated_at = now()
    where id = sk.id;
    return;
  end if;

  select exists (
    select 1 from public.skill_approvals a
    where a.skill_version_id = p_skill_version_id
      and a.approver_role = 'department_head'
      and a.decision = 'approved'
  ),
  exists (
    select 1 from public.skill_approvals a
    where a.skill_version_id = p_skill_version_id
      and a.approver_role = 'trainer'
      and a.decision = 'approved'
  )
  into head_ok, trainer_ok;

  if head_ok and trainer_ok then
    update public.skills
    set
      status = case when status = 'live' then 'live'::public.skill_status else 'approved'::public.skill_status end,
      current_version = case when status = 'live' then current_version else ver.version end,
      updated_at = now()
    where id = sk.id;
  end if;
end;
$$;

create function public.set_skill_live(
  p_skill_id uuid,
  p_live_since date
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  sk public.skills;
  ver public.skill_versions;
begin
  select * into sk from public.skills where id = p_skill_id for update;
  if not found then
    raise exception 'Skill not found.' using errcode = '22023';
  end if;

  if not (
    sk.owner_id = actor
    or (select public.has_role('trainer', 'admin'))
  ) then
    raise exception 'Only the owner or a trainer can set a Skill live.' using errcode = '42501';
  end if;

  if sk.owner_id is null then
    raise exception 'Assign an owner before going live.' using errcode = 'P0001';
  end if;

  if p_live_since is null then
    raise exception 'Live since date is required.' using errcode = 'P0001';
  end if;

  if sk.status = 'approved' then
    if sk.review_version_id is null then
      raise exception 'No approved version to publish.' using errcode = '22023';
    end if;
    select * into ver from public.skill_versions where id = sk.review_version_id;
    update public.skills
    set status = 'live',
        current_version = ver.version,
        live_since = p_live_since,
        review_version_id = null,
        updated_at = now()
    where id = p_skill_id;
    return;
  end if;

  if sk.status = 'live' and sk.review_version_id is not null then
    select * into ver from public.skill_versions where id = sk.review_version_id;
    if sk.status <> 'live' then
      raise exception 'Skill must be approved or live with a pending version.' using errcode = '22023';
    end if;
    update public.skills
    set current_version = ver.version,
        review_version_id = null,
        live_since = coalesce(live_since, p_live_since),
        updated_at = now()
    where id = p_skill_id;
    return;
  end if;

  raise exception 'Skill is not ready to go live.' using errcode = '22023';
end;
$$;

create function public.retire_skill(p_skill_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select public.has_role('trainer', 'admin')) then
    raise exception 'Only trainers and admins can retire Skills.' using errcode = '42501';
  end if;
  if p_reason is null or length(trim(p_reason)) < 10 then
    raise exception 'A retirement reason of at least 10 characters is required.' using errcode = 'P0001';
  end if;

  update public.skills
  set status = 'retired',
      retired_reason = left(trim(p_reason), 500),
      review_version_id = null,
      updated_at = now()
  where id = p_skill_id and status <> 'retired';

  if not found then
    raise exception 'Skill not found or already retired.' using errcode = '22023';
  end if;
end;
$$;

create function public.log_skill_usage(
  p_skill_id uuid,
  p_skill_version text,
  p_used_on date,
  p_task text,
  p_outcome public.skill_usage_outcome,
  p_minutes_saved integer,
  p_declaration boolean
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  sk public.skills;
  log_id uuid;
begin
  if actor is null then
    raise exception 'Sign in required.' using errcode = '42501';
  end if;
  if not p_declaration then
    raise exception 'Confirm that your log does not include client data.' using errcode = 'P0001';
  end if;
  if p_task is null or length(trim(p_task)) < 3 then
    raise exception 'Describe the task in a few words.' using errcode = 'P0001';
  end if;
  select * into sk from public.skills where id = p_skill_id;
  if not found or sk.status <> 'live' then
    raise exception 'Usage can only be logged for live Skills.' using errcode = '22023';
  end if;
  if p_skill_version is distinct from sk.current_version then
    raise exception 'Log use against the current live version (%).', sk.current_version using errcode = '22023';
  end if;

  insert into public.skill_usage_logs (
    skill_id, skill_version, user_id, used_on, task, outcome, minutes_saved, declaration
  )
  values (
    p_skill_id,
    p_skill_version,
    actor,
    coalesce(p_used_on, (current_timestamp at time zone 'Asia/Kuala_Lumpur')::date),
    left(trim(p_task), 200),
    p_outcome,
    p_minutes_saved,
    p_declaration
  )
  returning id into log_id;

  return log_id;
end;
$$;

create function public.update_skill_usage_log(
  p_log_id uuid,
  p_used_on date,
  p_task text,
  p_outcome public.skill_usage_outcome,
  p_minutes_saved integer,
  p_declaration boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  row public.skill_usage_logs;
begin
  select * into row from public.skill_usage_logs where id = p_log_id;
  if not found then
    raise exception 'Log not found.' using errcode = '22023';
  end if;
  if row.user_id <> actor then
    raise exception 'You can only edit your own logs.' using errcode = '42501';
  end if;
  if row.created_at < now() - interval '24 hours' then
    raise exception 'Logs can only be edited for 24 hours.' using errcode = '22023';
  end if;
  if not p_declaration then
    raise exception 'Confirm that your log does not include client data.' using errcode = 'P0001';
  end if;

  update public.skill_usage_logs
  set
    used_on = coalesce(p_used_on, row.used_on),
    task = left(trim(coalesce(p_task, row.task)), 200),
    outcome = coalesce(p_outcome, row.outcome),
    minutes_saved = p_minutes_saved,
    declaration = p_declaration
  where id = p_log_id;
end;
$$;

revoke all on function public.skill_min_test_cases() from public;
revoke all on function public.is_skill_department_head(uuid) from public;
revoke all on function public.is_skill_department_champion(uuid) from public;
revoke all on function public.can_read_skill_row(public.skills) from public;
revoke all on function public.validate_skill_version_md(uuid, text) from public;
revoke all on function public.save_skill_version(uuid, text, text, text, integer, integer, text) from public;
revoke all on function public.submit_skill_for_review(uuid) from public;
revoke all on function public.decide_skill_approval(uuid, public.skill_approval_decision, text) from public;
revoke all on function public.set_skill_live(uuid, date) from public;
revoke all on function public.retire_skill(uuid, text) from public;
revoke all on function public.log_skill_usage(uuid, text, date, text, public.skill_usage_outcome, integer, boolean) from public;
revoke all on function public.update_skill_usage_log(uuid, date, text, public.skill_usage_outcome, integer, boolean) from public;

grant execute on function public.skill_min_test_cases() to authenticated, service_role;
grant execute on function public.is_skill_department_head(uuid) to authenticated, service_role;
grant execute on function public.is_skill_department_champion(uuid) to authenticated, service_role;
grant execute on function public.can_read_skill_row(public.skills) to authenticated, service_role;
grant execute on function public.validate_skill_version_md(uuid, text) to authenticated, service_role;
grant execute on function public.save_skill_version(uuid, text, text, text, integer, integer, text) to authenticated, service_role;
grant execute on function public.submit_skill_for_review(uuid) to authenticated, service_role;
grant execute on function public.decide_skill_approval(uuid, public.skill_approval_decision, text) to authenticated, service_role;
grant execute on function public.set_skill_live(uuid, date) to authenticated, service_role;
grant execute on function public.retire_skill(uuid, text) to authenticated, service_role;
grant execute on function public.log_skill_usage(uuid, text, date, text, public.skill_usage_outcome, integer, boolean) to authenticated, service_role;
grant execute on function public.update_skill_usage_log(uuid, date, text, public.skill_usage_outcome, integer, boolean) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.skills enable row level security;
alter table public.skill_versions enable row level security;
alter table public.skill_approvals enable row level security;
alter table public.skill_usage_logs enable row level security;

revoke all on table public.skills, public.skill_versions, public.skill_approvals, public.skill_usage_logs from anon, authenticated;
grant select, insert, update, delete on table public.skills to authenticated;
grant select, insert, update, delete on table public.skill_versions to authenticated;
grant select, insert on table public.skill_approvals to authenticated;
grant select, insert, update on table public.skill_usage_logs to authenticated;
grant select, insert, update, delete on table public.skills, public.skill_versions, public.skill_approvals, public.skill_usage_logs to service_role;

revoke all on public.skill_usage_manager_counts from anon, authenticated, public;
grant select on public.skill_usage_manager_counts to service_role;

create policy "read skills"
  on public.skills for select to authenticated
  using (public.can_read_skill_row(skills));

create policy "staff insert skills"
  on public.skills for insert to authenticated
  with check ((select public.has_role('trainer', 'admin')));

create policy "staff update skills"
  on public.skills for update to authenticated
  using (
    (select public.has_role('trainer', 'admin'))
    or (
      status = 'draft'
      and (
        owner_id = auth.uid()
        or public.is_skill_department_champion(department_id)
      )
    )
  )
  with check (
    (select public.has_role('trainer', 'admin'))
    or (
      status in ('draft', 'in_review')
      and (
        owner_id = auth.uid()
        or public.is_skill_department_champion(department_id)
      )
    )
  );

create policy "trainers delete skills"
  on public.skills for delete to authenticated
  using ((select public.has_role('trainer', 'admin')));

create policy "read skill versions"
  on public.skill_versions for select to authenticated
  using (
    exists (
      select 1 from public.skills s
      where s.id = skill_versions.skill_id and public.can_read_skill_row(s)
    )
  );

create policy "write skill versions via rpc"
  on public.skill_versions for insert to authenticated
  with check ((select public.has_role('trainer', 'admin')));

create policy "trainers update skill versions"
  on public.skill_versions for update to authenticated
  using ((select public.has_role('trainer', 'admin')));

create policy "read skill approvals"
  on public.skill_approvals for select to authenticated
  using (
    exists (
      select 1
      from public.skill_versions v
      join public.skills s on s.id = v.skill_id
      where v.id = skill_approvals.skill_version_id
        and public.can_read_skill_row(s)
    )
  );

create policy "insert skill approvals via rpc"
  on public.skill_approvals for insert to authenticated
  with check (approver_id = auth.uid());

create policy "owners insert usage logs"
  on public.skill_usage_logs for insert to authenticated
  with check (user_id = auth.uid());

create policy "read usage logs"
  on public.skill_usage_logs for select to authenticated
  using (
    user_id = auth.uid()
    or (select public.has_role('trainer', 'admin'))
    or exists (
      select 1 from public.skills s
      where s.id = skill_usage_logs.skill_id
        and (s.owner_id = auth.uid() or public.is_skill_department_head(s.department_id))
    )
  );

create policy "owners update own usage logs"
  on public.skill_usage_logs for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

