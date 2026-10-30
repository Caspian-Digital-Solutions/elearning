-- Prompt 14: baseline tasks, baselines, time logs, F7 rule, aggregates.

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------

create type public.baseline_basis_type as enum ('measured', 'estimate');

create type public.time_log_outcome_type as enum ('kept', 'edited_heavily', 'discarded');

create type public.time_log_tool_type as enum ('claude', 'perplexity', 'chatgpt', 'other');

-- ---------------------------------------------------------------------------
-- Tasks (reference seed — PROPOSED until departments confirm)
-- ---------------------------------------------------------------------------

create table public.baseline_tasks (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments (id) on delete restrict,
  code text not null,
  name text not null,
  description text not null default '',
  unit text not null,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint baseline_tasks_code_unique unique (code),
  constraint baseline_tasks_minutes_name_len check (char_length(name) between 1 and 200)
);

comment on table public.baseline_tasks is
  'Department recurring tasks for baseline and time logging (Prompt 14).';

create index baseline_tasks_department_id_idx on public.baseline_tasks (department_id);

-- ---------------------------------------------------------------------------
-- Baselines and logs
-- ---------------------------------------------------------------------------

create table public.baselines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  task_id uuid not null references public.baseline_tasks (id) on delete restrict,
  minutes_without_ai integer not null,
  basis public.baseline_basis_type not null,
  set_on date not null default (timezone('Asia/Kuala_Lumpur', now()))::date,
  locked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint baselines_user_task_unique unique (user_id, task_id),
  constraint baselines_minutes_range check (minutes_without_ai between 1 and 2400)
);

create table public.time_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  task_id uuid not null references public.baseline_tasks (id) on delete restrict,
  logged_on date not null,
  minutes_with_ai integer not null,
  outcome public.time_log_outcome_type not null,
  tools public.time_log_tool_type[] not null default '{}',
  skill_id uuid references public.skills (id) on delete set null,
  prompt_id uuid references public.prompts (id) on delete set null,
  note text not null default '',
  declaration boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint time_logs_minutes_range check (minutes_with_ai between 1 and 2400),
  constraint time_logs_note_len check (char_length(note) <= 300),
  constraint time_logs_declaration_required check (declaration)
);

create index time_logs_user_task_idx on public.time_logs (user_id, task_id);
create index time_logs_logged_on_idx on public.time_logs (logged_on);

-- ---------------------------------------------------------------------------
-- Settings (PROPOSED)
-- ---------------------------------------------------------------------------

insert into public.app_settings (key, value, note)
values
  ('timelog.f7_required_logs', '2'::jsonb, 'PROPOSED — distinct tasks with a time log required for module F7.'),
  ('timelog.min_group_size', '3'::jsonb, 'PROPOSED — minimum people for manager-facing aggregate figures.')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.timelog_setting_int(p_key text, p_default integer)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select case jsonb_typeof(s.value)
        when 'number' then (s.value::text)::integer
        else (trim(both '"' from s.value::text))::integer
      end
      from public.app_settings s
      where s.key = p_key
    ),
    p_default
  );
$$;

revoke all on function public.timelog_setting_int(text, integer) from public, anon;
grant execute on function public.timelog_setting_int(text, integer) to authenticated, service_role;

create or replace function public.timelog_f7_required_logs()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select public.timelog_setting_int('timelog.f7_required_logs', 2);
$$;

create or replace function public.timelog_min_group_size()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select public.timelog_setting_int('timelog.min_group_size', 3);
$$;

create or replace function public.timelog_user_cohort_id(p_user_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.cohort_id from public.profiles p where p.id = p_user_id;
$$;

create or replace function public.timelog_week2_lock_instant(p_user_id uuid)
returns timestamptz
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  cohort_id uuid;
  week0 date;
  week_friday date;
begin
  select p.cohort_id, c.week0_start_date
    into cohort_id, week0
  from public.profiles p
  left join public.cohorts c on c.id = p.cohort_id
  where p.id = p_user_id;

  if cohort_id is null or week0 is null then
    return null;
  end if;

  select r.week_friday
    into week_friday
  from public._progress_programme_week_range(cohort_id, week0, 2) r
  limit 1;

  if week_friday is null then
    return null;
  end if;

  return (week_friday::timestamp + time '23:59:59') at time zone 'Asia/Kuala_Lumpur';
end;
$$;

create or replace function public.timelog_baseline_is_locked(p_user_id uuid, p_task_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  locked timestamptz;
  auto_lock timestamptz;
begin
  select b.locked_at into locked
  from public.baselines b
  where b.user_id = p_user_id and b.task_id = p_task_id;

  if locked is not null then
    return true;
  end if;

  auto_lock := public.timelog_week2_lock_instant(p_user_id);
  if auto_lock is not null and now() > auto_lock then
    return true;
  end if;

  return false;
end;
$$;

create or replace function public.timelog_log_editable_until(p_created_at timestamptz)
returns timestamptz
language sql
immutable
set search_path = ''
as $$
  select (
    ((p_created_at at time zone 'Asia/Kuala_Lumpur')::date + 7)::timestamp + time '23:59:59'
  ) at time zone 'Asia/Kuala_Lumpur';
$$;

create or replace function public.timelog_f7_distinct_tasks(p_user_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(distinct t.task_id)::integer
  from public.time_logs t
  where t.user_id = p_user_id
    and t.declaration;
$$;

create or replace function public.timelog_f7_satisfied(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.timelog_f7_distinct_tasks(p_user_id) >= public.timelog_f7_required_logs();
$$;

-- Extend module completion (lessons + quiz + F7 time logs)
create or replace function public._progress_module_complete(
  p_user_id uuid,
  p_module_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  published_lessons integer;
  completed_lessons integer;
  quiz_id uuid;
  pass_mark integer;
  quiz_ok boolean := true;
  mod_code text;
begin
  if p_user_id is null or not public.can_view_user(p_user_id) then
    return false;
  end if;

  select m.code into mod_code from public.modules m where m.id = p_module_id;

  select count(*)::integer
  into published_lessons
  from public.lessons l
  where l.module_id = p_module_id
    and l.status = 'published';

  if published_lessons = 0 then
    published_lessons := 0;
    completed_lessons := 0;
  else
    select count(*)::integer
    into completed_lessons
    from public.lessons l
    join public.lesson_progress lp on lp.lesson_id = l.id and lp.user_id = p_user_id
    where l.module_id = p_module_id
      and l.status = 'published';
  end if;

  if published_lessons > 0 and completed_lessons < published_lessons then
    return false;
  end if;

  select a.id, a.pass_mark_pct
  into quiz_id, pass_mark
  from public.assessments a
  where a.module_id = p_module_id
    and a.status = 'published'
    and a.type in ('quiz', 'safety_quiz')
  order by a.version desc
  limit 1;

  if quiz_id is not null then
    select exists (
      select 1
      from public.attempts att
      where att.user_id = p_user_id
        and att.assessment_id = quiz_id
        and att.status in ('submitted', 'marking', 'marked', 'confirmed')
        and (
          coalesce(att.passed, false)
          or (
            pass_mark is not null
            and att.percentage is not null
            and att.percentage >= pass_mark
          )
        )
    )
    into quiz_ok;
    if not coalesce(quiz_ok, false) then
      return false;
    end if;
  end if;

  if mod_code = 'F7' and not public.timelog_f7_satisfied(p_user_id) then
    return false;
  end if;

  return published_lessons = 0 or completed_lessons >= published_lessons;
end;
$$;

-- ---------------------------------------------------------------------------
-- Save baseline / log (RPC)
-- ---------------------------------------------------------------------------

create or replace function public.save_baseline(
  p_task_id uuid,
  p_minutes integer,
  p_basis public.baseline_basis_type
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  row_id uuid;
  dept uuid;
begin
  if actor is null then
    raise exception 'Sign in required.' using errcode = '42501';
  end if;

  if p_minutes is null or p_minutes < 1 or p_minutes > 2400 then
    raise exception 'Minutes must be between 1 and 2400.' using errcode = '22023';
  end if;

  select t.department_id into dept
  from public.baseline_tasks t
  join public.profiles p on p.id = actor
  where t.id = p_task_id
    and t.is_active
    and t.department_id = p.department_id;

  if dept is null then
    raise exception 'Task not available for your department.' using errcode = '42501';
  end if;

  if public.timelog_baseline_is_locked(actor, p_task_id)
     and not public.has_role('trainer', 'admin') then
    raise exception 'This baseline is locked.' using errcode = '42501';
  end if;

  insert into public.baselines (user_id, task_id, minutes_without_ai, basis, set_on)
  values (actor, p_task_id, p_minutes, p_basis, (timezone('Asia/Kuala_Lumpur', now()))::date)
  on conflict (user_id, task_id) do update
    set minutes_without_ai = excluded.minutes_without_ai,
        basis = excluded.basis,
        set_on = excluded.set_on,
        updated_at = now()
  returning id into row_id;

  return row_id;
end;
$$;

create or replace function public.trainer_update_locked_baseline(
  p_user_id uuid,
  p_task_id uuid,
  p_minutes integer,
  p_basis public.baseline_basis_type,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  row_id uuid;
  before_row jsonb;
  after_row jsonb;
begin
  if actor is null or not public.has_role('trainer', 'admin') then
    raise exception 'Only a trainer or admin can change a locked baseline.' using errcode = '42501';
  end if;

  if p_reason is null or length(trim(p_reason)) < 3 then
    raise exception 'A reason of at least 3 characters is required.' using errcode = '22023';
  end if;

  if p_minutes < 1 or p_minutes > 2400 then
    raise exception 'Minutes must be between 1 and 2400.' using errcode = '22023';
  end if;

  select to_jsonb(b.*) into before_row
  from public.baselines b
  where b.user_id = p_user_id and b.task_id = p_task_id;

  update public.baselines b
  set minutes_without_ai = p_minutes,
      basis = p_basis,
      updated_at = now()
  where b.user_id = p_user_id and b.task_id = p_task_id
  returning b.id into row_id;

  if row_id is null then
    raise exception 'Baseline not found.' using errcode = '22023';
  end if;

  select to_jsonb(b.*) into after_row from public.baselines b where b.id = row_id;

  insert into public.audit_log (actor_id, action, table_name, row_id, before, after, reason)
  values (actor, 'update', 'baselines', row_id, before_row, after_row, trim(p_reason));

  return row_id;
end;
$$;

create or replace function public.trainer_set_baseline_lock(
  p_user_id uuid,
  p_task_id uuid,
  p_lock boolean,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
begin
  if actor is null or not public.has_role('trainer', 'admin') then
    raise exception 'Only a trainer or admin can lock baselines.' using errcode = '42501';
  end if;

  if p_lock then
    update public.baselines b
    set locked_at = coalesce(b.locked_at, now()), updated_at = now()
    where b.user_id = p_user_id and b.task_id = p_task_id;
  else
    if p_reason is null or length(trim(p_reason)) < 3 then
      raise exception 'Unlocking requires a reason of at least 3 characters.' using errcode = '22023';
    end if;
    update public.baselines b
    set locked_at = null, updated_at = now()
    where b.user_id = p_user_id and b.task_id = p_task_id;
    insert into public.audit_log (actor_id, action, table_name, row_id, after, reason)
    values (
      actor,
      'update',
      'baselines',
      (select id from public.baselines where user_id = p_user_id and task_id = p_task_id),
      jsonb_build_object('locked_at', null),
      trim(p_reason)
    );
  end if;
end;
$$;

create or replace function public.save_time_log(
  p_log_id uuid,
  p_task_id uuid,
  p_logged_on date,
  p_minutes integer,
  p_outcome public.time_log_outcome_type,
  p_tools public.time_log_tool_type[],
  p_skill_id uuid,
  p_prompt_id uuid,
  p_note text,
  p_declaration boolean
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  row_id uuid;
  created timestamptz;
begin
  if actor is null then
    raise exception 'Sign in required.' using errcode = '42501';
  end if;

  if not p_declaration then
    raise exception 'You must confirm this entry has no client data.' using errcode = '22023';
  end if;

  if p_minutes < 1 or p_minutes > 2400 then
    raise exception 'Minutes must be between 1 and 2400.' using errcode = '22023';
  end if;

  if char_length(coalesce(p_note, '')) > 300 then
    raise exception 'Note must be 300 characters or fewer.' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.baseline_tasks t
    join public.profiles p on p.id = actor
    where t.id = p_task_id and t.is_active and t.department_id = p.department_id
  ) then
    raise exception 'Task not available for your department.' using errcode = '42501';
  end if;

  if p_log_id is not null then
    select t.created_at into created from public.time_logs t where t.id = p_log_id and t.user_id = actor;
    if created is null then
      raise exception 'Log not found.' using errcode = '22023';
    end if;
    if now() > public.timelog_log_editable_until(created) then
      raise exception 'This log can no longer be edited.' using errcode = '42501';
    end if;
    update public.time_logs t
    set task_id = p_task_id,
        logged_on = p_logged_on,
        minutes_with_ai = p_minutes,
        outcome = p_outcome,
        tools = coalesce(p_tools, '{}'),
        skill_id = p_skill_id,
        prompt_id = p_prompt_id,
        note = coalesce(p_note, ''),
        declaration = true,
        updated_at = now()
    where t.id = p_log_id and t.user_id = actor
    returning t.id into row_id;
    return row_id;
  end if;

  insert into public.time_logs (
    user_id, task_id, logged_on, minutes_with_ai, outcome, tools, skill_id, prompt_id, note, declaration
  )
  values (
    actor, p_task_id, p_logged_on, p_minutes, p_outcome, coalesce(p_tools, '{}'),
    p_skill_id, p_prompt_id, coalesce(p_note, ''), true
  )
  returning id into row_id;

  return row_id;
end;
$$;

revoke all on function public.save_baseline(uuid, integer, public.baseline_basis_type) from public, anon;
grant execute on function public.save_baseline(uuid, integer, public.baseline_basis_type) to authenticated, service_role;

revoke all on function public.save_time_log(uuid, uuid, date, integer, public.time_log_outcome_type, public.time_log_tool_type[], uuid, uuid, text, boolean) from public, anon;
grant execute on function public.save_time_log(uuid, uuid, date, integer, public.time_log_outcome_type, public.time_log_tool_type[], uuid, uuid, text, boolean) to authenticated, service_role;

revoke all on function public.trainer_update_locked_baseline(uuid, uuid, integer, public.baseline_basis_type, text) from public, anon;
grant execute on function public.trainer_update_locked_baseline(uuid, uuid, integer, public.baseline_basis_type, text) to authenticated, service_role;

revoke all on function public.trainer_set_baseline_lock(uuid, uuid, boolean, text) from public, anon;
grant execute on function public.trainer_set_baseline_lock(uuid, uuid, boolean, text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Seed PROPOSED tasks
-- ---------------------------------------------------------------------------

insert into public.baseline_tasks (department_id, code, name, description, unit, sort_order, note)
select d.id, v.code, v.name, v.description, v.unit, v.sort_order,
  'PROPOSED — department heads to confirm'
from (values
  ('content', 'content-blog-draft', 'Blog article first draft', 'First draft of a blog article for CDS or a client.', 'one article', 1),
  ('content', 'content-social-captions', 'Social caption set', 'Captions for a batch of social posts.', '10 captions', 2),
  ('content', 'content-brief', 'Content brief', 'Brief for a piece of content or campaign.', 'one brief', 3),
  ('creative', 'creative-brief-client', 'Creative brief from client request', 'Turn a client ask into an internal creative brief.', 'one brief', 1),
  ('creative', 'creative-feedback-consolidated', 'Design feedback consolidated', 'Pull Jira and Figma comments into one summary.', 'one round', 2),
  ('performance-seo', 'perf-seo-monthly-report', 'Monthly SEO/AEO/GEO report narrative', 'Narrative section of the monthly SEO report.', 'one monthly report', 1),
  ('performance-seo', 'perf-seo-keyword-scan', 'Keyword and competitor scan', 'Keyword and competitor research pass.', 'one scan', 2),
  ('performance-paid', 'perf-paid-campaign-summary', 'Monthly campaign performance summary', 'Summary of paid campaign results.', 'one monthly summary', 1),
  ('performance-paid', 'perf-paid-ad-copy', 'Ad copy variants', 'Draft variants for ads.', '5 variants', 2),
  ('performance-analytics', 'perf-analytics-weekly-funnel', 'Weekly lead and enrolment funnel report', 'Weekly funnel metrics report.', 'one weekly report', 1),
  ('performance-analytics', 'perf-analytics-dashboard-commentary', 'Dashboard commentary', 'Written commentary on dashboard metrics.', 'one commentary', 2),
  ('account-management', 'am-call-minutes', 'Client call minutes with actions and owners', 'Minutes and actions from a client call.', 'one call', 1),
  ('account-management', 'am-email-reply', 'Client email reply draft', 'Draft reply to a client email.', 'one reply', 2),
  ('senior-management', 'sm-decision-brief', 'Decision brief', 'Brief for an internal decision.', 'one brief', 1),
  ('senior-management', 'sm-rfp-outline', 'RFP or proposal response outline', 'Outline for an RFP or proposal response.', 'one outline', 2)
) as v (dept_code, code, name, description, unit, sort_order)
join public.departments d on d.code = v.dept_code
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description,
  unit = excluded.unit,
  sort_order = excluded.sort_order,
  note = excluded.note;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.baseline_tasks enable row level security;
alter table public.baselines enable row level security;
alter table public.time_logs enable row level security;

create policy baseline_tasks_select on public.baseline_tasks
  for select to authenticated
  using (
    public.has_role('trainer', 'admin')
    or department_id = (select p.department_id from public.profiles p where p.id = (select auth.uid()) and p.is_active)
  );

create policy baseline_tasks_trainer_write on public.baseline_tasks
  for all to authenticated
  using (public.has_role('trainer', 'admin'))
  with check (public.has_role('trainer', 'admin'));

create policy baselines_owner on public.baselines
  for all to authenticated
  using (user_id = (select auth.uid()) or public.has_role('trainer', 'admin'))
  with check (user_id = (select auth.uid()) or public.has_role('trainer', 'admin'));

create policy time_logs_owner on public.time_logs
  for all to authenticated
  using (user_id = (select auth.uid()) or public.has_role('trainer', 'admin'))
  with check (user_id = (select auth.uid()) or public.has_role('trainer', 'admin'));

grant select on public.baseline_tasks to authenticated, service_role;
grant select, insert, update on public.baselines to authenticated, service_role;
grant select, insert, update on public.time_logs to authenticated, service_role;

-- Trainer task writes via policy above; owners use RPC for baselines/logs to enforce locks.

-- ---------------------------------------------------------------------------
-- Aggregate view (trainers/admin/managers with scope)
-- ---------------------------------------------------------------------------

create or replace view public.time_log_department_task_stats
with (security_invoker = true) as
with log_stats as (
  select
    t.department_id,
    t.id as task_id,
    t.code as task_code,
    t.name as task_name,
    count(distinct b.user_id) filter (where not coalesce(p.is_test_account, false)) as people_with_baseline,
    percentile_cont(0.5) within group (order by b.minutes_without_ai)
      filter (where b.id is not null and not coalesce(p.is_test_account, false)) as median_baseline_minutes,
    count(distinct l.user_id) filter (where not coalesce(p2.is_test_account, false)) as people_logging,
    count(l.id) filter (where not coalesce(p2.is_test_account, false)) as log_count,
    percentile_cont(0.5) within group (order by l.minutes_with_ai)
      filter (where l.id is not null and not coalesce(p2.is_test_account, false)) as median_minutes_with_ai,
    count(*) filter (where l.outcome = 'kept' and not coalesce(p2.is_test_account, false)) as outcome_kept,
    count(*) filter (where l.outcome = 'edited_heavily' and not coalesce(p2.is_test_account, false)) as outcome_edited,
    count(*) filter (where l.outcome = 'discarded' and not coalesce(p2.is_test_account, false)) as outcome_discarded
  from public.baseline_tasks t
  left join public.baselines b on b.task_id = t.id
  left join public.profiles p on p.id = b.user_id
  left join public.time_logs l on l.task_id = t.id
  left join public.profiles p2 on p2.id = l.user_id
  where t.is_active
  group by t.department_id, t.id, t.code, t.name
)
select
  s.*,
  d.name as department_name,
  d.code as department_code
from log_stats s
join public.departments d on d.id = s.department_id
where public.can_view_department(s.department_id);

grant select on public.time_log_department_task_stats to authenticated, service_role;

create or replace view public.time_log_trainer_rows
with (security_invoker = true) as
select
  l.id,
  l.user_id,
  p.full_name as person_name,
  p.department_id,
  d.name as department_name,
  l.task_id,
  t.code as task_code,
  t.name as task_name,
  l.logged_on,
  l.minutes_with_ai,
  l.outcome,
  l.tools,
  l.note,
  l.created_at,
  coalesce(p.is_test_account, false) as is_test_account
from public.time_logs l
join public.profiles p on p.id = l.user_id
join public.departments d on d.id = p.department_id
join public.baseline_tasks t on t.id = l.task_id
where public.has_role('trainer', 'admin');

grant select on public.time_log_trainer_rows to authenticated, service_role;

revoke insert, update, delete on public.baselines from authenticated;
revoke insert, update, delete on public.time_logs from authenticated;
