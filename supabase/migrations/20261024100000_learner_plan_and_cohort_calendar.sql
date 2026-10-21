-- Purpose: learner plan generation, cohort calendar anchors, cohort breaks,
--   plan overrides, sample attempt discard, and tighter learner_plan RLS.
-- Tables touched: cohorts, cohort_breaks (new), learner_plan, app_settings.
-- Functions: generate_learner_plan, override_plan_item, discard_sample_in_progress_attempt;
--   confirm_placement replaced to build the plan after stream confirmation.
-- Prompt: 08 (My path, learner plan, cohort calendar).

-- Cohorts: Week 0 anchor ------------------------------------------------------

alter table public.cohorts
  add column if not exists week0_start_date date
    check (
      week0_start_date is null
      or extract(isodow from week0_start_date) = 1
    );

comment on column public.cohorts.week0_start_date is
  'Monday Week 0 starts. Programme week 1 aligns with curriculum module week_start.';

update public.cohorts c
set week0_start_date = c.start_date
where c.week0_start_date is null
  and c.start_date is not null;

-- Cohort breaks --------------------------------------------------------------

create table public.cohort_breaks (
  id uuid primary key default gen_random_uuid(),
  cohort_id uuid not null references public.cohorts (id) on delete cascade,
  start_date date not null
    check (extract(isodow from start_date) = 1),
  weeks integer not null check (weeks >= 1),
  label text not null check (char_length(btrim(label)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cohort_id, start_date)
);

comment on table public.cohort_breaks is
  'Holiday or pause weeks on the cohort calendar. Each break pushes later programme weeks back.';

create index cohort_breaks_cohort_id_idx on public.cohort_breaks (cohort_id);

create trigger cohort_breaks_set_updated_at before update on public.cohort_breaks
  for each row execute function public.set_updated_at();

create trigger cohort_breaks_audit after insert or update or delete on public.cohort_breaks
  for each row execute function public.audit_row_change();

-- Learner plan columns -------------------------------------------------------

alter table public.learner_plan
  add column if not exists is_override boolean not null default false,
  add column if not exists due_week integer check (due_week is null or due_week >= 0),
  add column if not exists override_reason text;

comment on column public.learner_plan.is_override is
  'When true, generate_learner_plan leaves this row unchanged.';
comment on column public.learner_plan.due_week is
  'Programme week by which the module should be finished (module week_end, or bridge_due_week for bridges).';
comment on column public.learner_plan.override_reason is
  'Trainer reason when is_override is true. Generator narrative stays in reason.';

create trigger learner_plan_audit after insert or update or delete on public.learner_plan
  for each row execute function public.audit_row_change();

-- App settings: plan.stream_rules --------------------------------------------

insert into public.app_settings (key, value, note)
values (
  'plan.stream_rules',
  '{
    "bridge_due_week": 4,
    "senior_management_department_code": "senior-management",
    "streams": {
      "foundation": {
        "tested_out": [],
        "optional": []
      },
      "practitioner": {
        "tested_out": ["F1", "F2", "F4", "F5", "F6"],
        "optional": []
      },
      "practitioner_fast_track": {
        "tested_out": ["F1", "F2", "F4", "F5", "F6"],
        "optional": ["P1", "P2"]
      },
      "champion": {
        "tested_out": ["F1", "F2", "F4", "F5", "F6"],
        "optional": ["P1", "P2"]
      }
    }
  }'::jsonb,
  'PROPOSED — Bharg to confirm Practitioner test-out list'
)
on conflict (key) do nothing;

-- Helpers --------------------------------------------------------------------

create or replace function public._plan_rules_module_list_contains(
  p_rules jsonb,
  p_stream public.stream_type,
  p_list text,
  p_module_code text
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select exists (
    select 1
    from jsonb_array_elements_text(
      coalesce(
        p_rules -> 'streams' -> p_stream::text -> p_list,
        '[]'::jsonb
      )
    ) as elem(code)
    where elem.code = p_module_code
  );
$$;

comment on function public._plan_rules_module_list_contains(jsonb, public.stream_type, text, text) is
  'Whether a module code appears in a stream''s tested_out or optional list inside plan.stream_rules.';

revoke execute on function public._plan_rules_module_list_contains(jsonb, public.stream_type, text, text)
  from public, anon, authenticated;

-- generate_learner_plan ------------------------------------------------------

create or replace function public.generate_learner_plan(p_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  usr public.profiles;
  rules jsonb;
  bridge_due_week integer := 4;
  senior_mgmt_code text := 'senior-management';
  dept_code text;
  bridge_codes text[] := '{}';
  stream_label text;
  mod_rec record;
  row_status public.plan_status;
  row_due_week integer;
  row_reason text;
  inserted integer := 0;
begin
  perform public.require_trainer_or_admin();

  select * into usr from public.profiles p where p.id = p_user_id;
  if not found then
    raise exception 'Person not found.' using errcode = '22023';
  end if;

  if usr.stream is null then
    raise exception 'Set a stream before building a learning plan.' using errcode = '22023';
  end if;

  select s.value into rules
  from public.app_settings s
  where s.key = 'plan.stream_rules';

  if rules is null then
    raise exception 'plan.stream_rules is not configured.' using errcode = '22023';
  end if;

  bridge_due_week := coalesce((rules ->> 'bridge_due_week')::integer, 4);
  senior_mgmt_code := coalesce(rules ->> 'senior_management_department_code', 'senior-management');
  stream_label := initcap(replace(usr.stream::text, '_', ' '));

  select coalesce(pr.bridges, '{}')
  into bridge_codes
  from public.placement_results pr
  where pr.user_id = p_user_id
    and pr.confirmed_at is not null
  order by pr.confirmed_at desc
  limit 1;

  bridge_codes := coalesce(bridge_codes, '{}');

  if usr.department_id is not null then
    select d.code into dept_code
    from public.departments d
    where d.id = usr.department_id;
  end if;

  delete from public.learner_plan lp
  where lp.user_id = p_user_id
    and not lp.is_override;

  for mod_rec in
    select
      m.id,
      m.code,
      m.week_end,
      m.is_leadership,
      st.code as stage_code
    from public.modules m
    join public.stages st on st.id = m.stage_id
    where st.code in ('foundation', 'practitioner', 'apply_certify', 'specialist', 'leadership')
    order by st.sort_order, m.sort_order, m.code
  loop
    if mod_rec.code = any (bridge_codes) then
      row_status := 'bridge';
      row_due_week := bridge_due_week;
      row_reason := 'Bridge: from Week 0 placement result';
    elsif mod_rec.stage_code = 'specialist' then
      row_status := 'not_applicable';
      row_due_week := null;
      row_reason := 'Specialist track: not applicable until nomination (Phase 3)';
    elsif mod_rec.is_leadership or mod_rec.stage_code = 'leadership' then
      if dept_code = senior_mgmt_code then
        row_status := 'required';
        row_due_week := mod_rec.week_end;
        row_reason := 'Leadership briefing: required for Senior Management';
      elsif usr.role = 'manager' then
        row_status := 'optional';
        row_due_week := mod_rec.week_end;
        row_reason := 'Leadership briefing: optional for managers';
      else
        row_status := 'not_applicable';
        row_due_week := null;
        row_reason := 'Leadership briefing: not applicable';
      end if;
    elsif public._plan_rules_module_list_contains(rules, usr.stream, 'tested_out', mod_rec.code) then
      row_status := 'tested_out';
      row_due_week := mod_rec.week_end;
      row_reason := stream_label || ' stream: tested out';
    elsif public._plan_rules_module_list_contains(rules, usr.stream, 'optional', mod_rec.code) then
      row_status := 'optional';
      row_due_week := mod_rec.week_end;
      row_reason := stream_label || ' stream: optional';
    else
      row_status := 'required';
      row_due_week := mod_rec.week_end;
      row_reason := stream_label || ' stream: required';
    end if;

    if exists (
      select 1
      from public.learner_plan lp
      where lp.user_id = p_user_id
        and lp.module_id = mod_rec.id
        and lp.is_override
    ) then
      continue;
    end if;

    insert into public.learner_plan (
      user_id,
      module_id,
      status,
      reason,
      due_week,
      is_override,
      override_reason,
      set_by
    )
    values (
      p_user_id,
      mod_rec.id,
      row_status,
      row_reason,
      row_due_week,
      false,
      null,
      actor
    );

    inserted := inserted + 1;
  end loop;

  return inserted;
end;
$$;

comment on function public.generate_learner_plan(uuid) is
  'Trainer or admin: rebuilds generated learner_plan rows from stream, placement bridges and plan.stream_rules. Keeps overrides.';

-- override_plan_item ---------------------------------------------------------

create or replace function public.override_plan_item(
  p_user_id uuid,
  p_module_id uuid,
  p_status public.plan_status,
  p_reason text
)
returns public.learner_plan
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  clean_reason text := nullif(btrim(p_reason), '');
  mod_week_end integer;
  result public.learner_plan;
begin
  perform public.require_trainer_or_admin();

  if clean_reason is null or length(clean_reason) < 10 then
    raise exception 'Give a reason of at least ten characters.' using errcode = '22023';
  end if;

  if not exists (select 1 from public.profiles p where p.id = p_user_id) then
    raise exception 'Person not found.' using errcode = '22023';
  end if;

  select m.week_end into mod_week_end
  from public.modules m
  where m.id = p_module_id;

  if not found then
    raise exception 'Module not found.' using errcode = '22023';
  end if;

  insert into public.learner_plan (
    user_id,
    module_id,
    status,
    reason,
    due_week,
    is_override,
    override_reason,
    set_by
  )
  values (
    p_user_id,
    p_module_id,
    p_status,
    'Manual override by trainer',
    mod_week_end,
    true,
    clean_reason,
    actor
  )
  on conflict (user_id, module_id) do update set
    status = excluded.status,
    reason = excluded.reason,
    due_week = coalesce(public.learner_plan.due_week, excluded.due_week),
    is_override = true,
    override_reason = excluded.override_reason,
    set_by = excluded.set_by,
    updated_at = now()
  returning * into result;

  return result;
end;
$$;

comment on function public.override_plan_item(uuid, uuid, public.plan_status, text) is
  'Trainer or admin: sets one plan row with is_override and a recorded reason.';

-- discard_sample_in_progress_attempt -------------------------------------------

create or replace function public.discard_sample_in_progress_attempt(
  p_attempt_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  clean_reason text := nullif(btrim(p_reason), '');
  att public.attempts;
  asm public.assessments;
begin
  perform public.require_trainer_or_admin();

  if clean_reason is null or length(clean_reason) < 10 then
    raise exception 'Give a reason of at least ten characters.' using errcode = '22023';
  end if;

  select * into att from public.attempts a where a.id = p_attempt_id;
  if not found then
    raise exception 'Attempt not found.' using errcode = '22023';
  end if;

  if att.status <> 'in_progress' then
    raise exception 'Only an in-progress attempt can be discarded.' using errcode = '22023';
  end if;

  select * into asm from public.assessments a where a.id = att.assessment_id;
  if asm.type <> 'placement' or not asm.is_sample then
    raise exception 'Only in-progress sample placement attempts can be discarded.'
      using errcode = '22023';
  end if;

  perform set_config('app.change_reason', clean_reason, true);

  insert into public.audit_log (actor_id, action, table_name, row_id, before, after)
  values (actor, 'delete', 'attempts', att.id, to_jsonb(att), null);

  delete from public.attempts a where a.id = att.id;

  perform set_config('app.change_reason', '', true);
end;
$$;

comment on function public.discard_sample_in_progress_attempt(uuid, text) is
  'Trainer or admin: deletes an in-progress Week 0 sample attempt so the learner can start fresh.';

-- confirm_placement: build plan after stream update --------------------------

create or replace function public.confirm_placement(
  p_attempt_id uuid,
  p_stream public.stream_type,
  p_reason text default null,
  p_portfolio_reviewed boolean default false
)
returns public.placement_results
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  att public.attempts;
  pr public.placement_results;
  reason text := nullif(btrim(p_reason), '');
begin
  perform public.require_trainer_or_admin();

  select * into att from public.attempts a where a.id = p_attempt_id;
  if not found then
    raise exception 'Attempt not found.' using errcode = '22023';
  end if;

  select * into pr from public.placement_results r where r.attempt_id = p_attempt_id;
  if not found then
    raise exception 'Calculate placement before confirming.' using errcode = '22023';
  end if;

  if pr.confirmed_at is not null then
    raise exception 'Placement is already confirmed.' using errcode = '22023';
  end if;

  if p_stream is distinct from pr.suggested_stream and reason is null then
    raise exception 'Give a reason when overriding the suggested stream.'
      using errcode = '22023';
  end if;

  if p_stream = 'champion' and not coalesce(p_portfolio_reviewed, false) then
    raise exception 'Champion placement requires portfolio review.' using errcode = '22023';
  end if;

  update public.placement_results r
  set
    confirmed_stream = p_stream,
    confirmed_by = actor,
    confirmed_at = now(),
    override_reason = case when p_stream is distinct from r.suggested_stream then reason else null end,
    portfolio_reviewed = coalesce(p_portfolio_reviewed, false),
    updated_at = now()
  where r.attempt_id = p_attempt_id
  returning * into pr;

  update public.profiles p
  set stream = p_stream, updated_at = now()
  where p.id = att.user_id;

  update public.attempts a
  set status = 'confirmed', updated_at = now()
  where a.id = p_attempt_id;

  perform public.generate_learner_plan(att.user_id);

  return pr;
end;
$$;

comment on function public.confirm_placement(uuid, public.stream_type, text, boolean) is
  'Trainer or admin: confirms stream, updates profile, locks the attempt, and builds the learning plan.';

-- Grants: new functions ------------------------------------------------------

revoke execute on function public.generate_learner_plan(uuid) from public, anon;
revoke execute on function public.override_plan_item(uuid, uuid, public.plan_status, text) from public, anon;
revoke execute on function public.discard_sample_in_progress_attempt(uuid, text) from public, anon;

grant execute on function public.generate_learner_plan(uuid) to authenticated;
grant execute on function public.override_plan_item(uuid, uuid, public.plan_status, text) to authenticated;
grant execute on function public.discard_sample_in_progress_attempt(uuid, text) to authenticated;

-- Row-level security: cohort_breaks ------------------------------------------

alter table public.cohort_breaks enable row level security;

revoke all on table public.cohort_breaks from anon, authenticated;

grant select, insert, update, delete on table public.cohort_breaks to authenticated;
grant select, insert, update, delete on table public.cohort_breaks to service_role;

create policy "staff read cohort breaks" on public.cohort_breaks
  for select to authenticated
  using ((select public.current_app_role()) is not null);

create policy "trainers and admins manage cohort breaks" on public.cohort_breaks
  for all to authenticated
  using ((select public.has_role('trainer', 'admin')))
  with check ((select public.has_role('trainer', 'admin')));

-- Row-level security: learner_plan (function-driven writes) --------------------

drop policy if exists "trainers and admins add learner plan rows" on public.learner_plan;
drop policy if exists "trainers and admins change learner plan rows" on public.learner_plan;
drop policy if exists "trainers and admins remove learner plan rows" on public.learner_plan;

-- Reads unchanged: people read learner plans they may see (can_view_user).
