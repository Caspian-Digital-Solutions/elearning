-- Purpose: entry-stream test-outs (DL-027), plan.stream_rules shape, test_out_pending status,
--   apply_test_out_result, generate_learner_plan refresh, submit_attempt hook.
-- Tables touched: app_settings, learner_plan.
-- Functions: _plan_rules_list_contains, _plan_test_out_week_for_module, _plan_module_in_test_out,
--   generate_learner_plan (replace), apply_test_out_result (new), submit_attempt (replace).
-- Prompt: 08b (test-outs per programme architecture).

-- plan_status ----------------------------------------------------------------

alter type public.plan_status add value if not exists 'test_out_pending';

-- plan.stream_rules (DL-027) -------------------------------------------------

do $$
declare
  new_rules jsonb := $json$
{
  "bridge_due_week": 4,
  "senior_management_department_code": "senior-management",
  "streams": {
    "foundation": {
      "required": ["F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8", "F9", "P1", "P2", "P3", "P4", "P5", "P6", "P7", "P8", "P9", "P10"],
      "optional": [],
      "tested_out": [],
      "test_outs": []
    },
    "practitioner": {
      "required": ["F7", "F8", "F9", "P1", "P2", "P3", "P4", "P5", "P6", "P7", "P8", "P9", "P10"],
      "optional": [],
      "tested_out": [],
      "test_outs": [
        {
          "code": "week1",
          "modules": ["F1", "F2", "F3", "F4", "F5", "F6"],
          "via": "assessment",
          "source_code": "week1-testout",
          "week": 1
        }
      ]
    },
    "practitioner_fast_track": {
      "required": ["F7", "F8", "F9", "P3", "P4", "P5", "P6", "P7", "P8", "P9", "P10"],
      "optional": [],
      "tested_out": [],
      "test_outs": [
        {
          "code": "week1",
          "modules": ["F1", "F2", "F3", "F4", "F5", "F6"],
          "via": "assessment",
          "source_code": "week1-testout",
          "week": 1
        },
        {
          "code": "week5",
          "modules": ["P1", "P2"],
          "via": "assignment",
          "source_code": "week5-testout",
          "week": 5
        }
      ]
    },
    "champion": {
      "required": ["F7", "F8", "F9", "P3", "P4", "P5", "P6", "P7", "P8", "P9", "P10"],
      "optional": [],
      "tested_out": [],
      "test_outs": [
        {
          "code": "week1",
          "modules": ["F1", "F2", "F3", "F4", "F5", "F6"],
          "via": "assessment",
          "source_code": "week1-testout",
          "week": 1
        },
        {
          "code": "week5",
          "modules": ["P1", "P2"],
          "via": "assignment",
          "source_code": "week5-testout",
          "week": 5
        }
      ],
      "specialist_eligible": true
    }
  }
}
$json$::jsonb;
begin
  if not exists (select 1 from public.app_settings s where s.key = 'plan.stream_rules') then
    raise exception 'plan.stream_rules is not configured.' using errcode = '22023';
  end if;

  perform set_config('app.change_reason', 'DL-027: streams per programme architecture', true);

  update public.app_settings s
  set
    value = new_rules,
    note = 'From the programme architecture entry-streams table (DL-027). PROPOSED'
  where s.key = 'plan.stream_rules';

  perform set_config('app.change_reason', '', true);
end;
$$;

-- Helpers --------------------------------------------------------------------

create or replace function public._plan_rules_list_contains(
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

comment on function public._plan_rules_list_contains(jsonb, public.stream_type, text, text) is
  'Whether a module code appears in a named list (required, optional, tested_out) inside plan.stream_rules.';

create or replace function public._plan_module_in_test_out(
  p_rules jsonb,
  p_stream public.stream_type,
  p_module_code text
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select exists (
    select 1
    from jsonb_array_elements(
      coalesce(p_rules -> 'streams' -> p_stream::text -> 'test_outs', '[]'::jsonb)
    ) as test_out(elem)
    cross join lateral jsonb_array_elements_text(
      coalesce(test_out.elem -> 'modules', '[]'::jsonb)
    ) as mod(code)
    where mod.code = p_module_code
  );
$$;

comment on function public._plan_module_in_test_out(jsonb, public.stream_type, text) is
  'Whether a module code is listed in any test_outs[].modules entry for the stream.';

create or replace function public._plan_test_out_week_for_module(
  p_rules jsonb,
  p_stream public.stream_type,
  p_module_code text
)
returns integer
language sql
immutable
set search_path = ''
as $$
  select (test_out.elem ->> 'week')::integer
  from jsonb_array_elements(
    coalesce(p_rules -> 'streams' -> p_stream::text -> 'test_outs', '[]'::jsonb)
  ) as test_out(elem)
  cross join lateral jsonb_array_elements_text(
    coalesce(test_out.elem -> 'modules', '[]'::jsonb)
  ) as mod(code)
  where mod.code = p_module_code
  order by (test_out.elem ->> 'week')::integer
  limit 1;
$$;

comment on function public._plan_test_out_week_for_module(jsonb, public.stream_type, text) is
  'Programme week for a pending test-out gate on this module (from test_outs[].week).';

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
  select public._plan_rules_list_contains(p_rules, p_stream, p_list, p_module_code);
$$;

revoke execute on function public._plan_rules_list_contains(jsonb, public.stream_type, text, text)
  from public, anon, authenticated;
revoke execute on function public._plan_module_in_test_out(jsonb, public.stream_type, text)
  from public, anon, authenticated;
revoke execute on function public._plan_test_out_week_for_module(jsonb, public.stream_type, text)
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
  if coalesce(current_setting('app.migration_plan_regen', true), '') <> 'true' then
    perform public.require_trainer_or_admin();
  end if;

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
    and not lp.is_override
    and not (
      lp.reason ilike 'Passed %test-out%'
      or lp.reason ilike '%test-out not passed%'
    );

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
    elsif public._plan_module_in_test_out(rules, usr.stream, mod_rec.code) then
      row_status := 'test_out_pending';
      row_due_week := public._plan_test_out_week_for_module(rules, usr.stream, mod_rec.code);
      row_reason := stream_label || ' stream: pass test-out to skip';
    elsif public._plan_rules_list_contains(rules, usr.stream, 'required', mod_rec.code) then
      row_status := 'required';
      row_due_week := mod_rec.week_end;
      row_reason := stream_label || ' stream: required';
    elsif public._plan_rules_list_contains(rules, usr.stream, 'optional', mod_rec.code) then
      row_status := 'optional';
      row_due_week := mod_rec.week_end;
      row_reason := stream_label || ' stream: optional';
    elsif public._plan_rules_list_contains(rules, usr.stream, 'tested_out', mod_rec.code) then
      row_status := 'tested_out';
      row_due_week := null;
      row_reason := stream_label || ' stream: tested out';
    else
      row_status := 'not_applicable';
      row_due_week := null;
      row_reason := 'Not in plan for this stream';
    end if;

    if exists (
      select 1
      from public.learner_plan lp
      where lp.user_id = p_user_id
        and lp.module_id = mod_rec.id
        and (
          lp.is_override
          or lp.reason ilike 'Passed %test-out%'
          or lp.reason ilike '%test-out not passed%'
        )
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
  'Trainer or admin: rebuilds generated learner_plan rows from stream, bridges and plan.stream_rules. Keeps overrides and applied test-out results.';

-- apply_test_out_result ------------------------------------------------------

create or replace function public.apply_test_out_result(
  p_user_id uuid,
  p_test_out_code text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  usr public.profiles;
  rules jsonb;
  test_out jsonb;
  test_out_week integer;
  asm public.assessments;
  att public.attempts;
  attempt_count integer;
  mod_code text;
  mod_id uuid;
  mod_week_end integer;
  result_date text;
  pass_reason text;
  fail_reason text;
begin
  select * into usr from public.profiles p where p.id = p_user_id;
  if not found then
    raise exception 'Person not found.' using errcode = '22023';
  end if;

  if usr.stream is null then
    return;
  end if;

  select s.value into rules
  from public.app_settings s
  where s.key = 'plan.stream_rules';

  if rules is null then
    return;
  end if;

  select elem into test_out
  from jsonb_array_elements(
    coalesce(rules -> 'streams' -> usr.stream::text -> 'test_outs', '[]'::jsonb)
  ) as test_out(elem)
  where test_out.elem ->> 'code' = p_test_out_code
  limit 1;

  if test_out is null then
    return;
  end if;

  if coalesce(test_out ->> 'via', '') <> 'assessment' then
    return;
  end if;

  test_out_week := (test_out ->> 'week')::integer;

  select * into asm
  from public.assessments a
  where a.code = (test_out ->> 'source_code');

  if not found then
    return;
  end if;

  select * into att
  from public.attempts a
  where a.user_id = p_user_id
    and a.assessment_id = asm.id
    and a.status in ('submitted', 'marking', 'marked', 'confirmed')
  order by a.submitted_at desc nulls last, a.updated_at desc
  limit 1;

  if not found then
    return;
  end if;

  result_date := to_char(
    coalesce(att.submitted_at, now()) at time zone 'Asia/Kuala_Lumpur',
    'DD Mon YYYY'
  );
  pass_reason := 'Passed Week ' || test_out_week::text || ' test-out on ' || result_date;
  fail_reason := 'Week ' || test_out_week::text || ' test-out not passed on ' || result_date;

  if coalesce(att.passed, false) then
    for mod_code in
      select jsonb_array_elements_text(coalesce(test_out -> 'modules', '[]'::jsonb))
    loop
      select m.id into mod_id
      from public.modules m
      where m.code = mod_code;

      if not found then
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
        mod_id,
        'tested_out',
        pass_reason,
        null,
        false,
        null,
        actor
      )
      on conflict (user_id, module_id) do update set
        status = 'tested_out',
        reason = excluded.reason,
        due_week = null,
        is_override = false,
        override_reason = null,
        set_by = excluded.set_by,
        updated_at = now();
    end loop;

    return;
  end if;

  select count(*)::integer into attempt_count
  from public.attempts a
  where a.user_id = p_user_id
    and a.assessment_id = asm.id
    and a.status in ('submitted', 'marking', 'marked', 'confirmed');

  if asm.max_attempts is not null and attempt_count < asm.max_attempts then
    return;
  end if;

  for mod_code in
    select jsonb_array_elements_text(coalesce(test_out -> 'modules', '[]'::jsonb))
  loop
    select m.id, m.week_end into mod_id, mod_week_end
    from public.modules m
    where m.code = mod_code;

    if not found then
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
      mod_id,
      'required',
      fail_reason,
      mod_week_end,
      false,
      null,
      actor
    )
    on conflict (user_id, module_id) do update set
      status = 'required',
      reason = excluded.reason,
      due_week = excluded.due_week,
      is_override = false,
      override_reason = null,
      set_by = excluded.set_by,
      updated_at = now();
  end loop;
end;
$$;

comment on function public.apply_test_out_result(uuid, text) is
  'Internal: applies a quiz test-out pass or final fail to learner_plan. Not callable by learners directly.';

revoke all on function public.apply_test_out_result(uuid, text) from public;
revoke execute on function public.apply_test_out_result(uuid, text) from anon, authenticated;
grant execute on function public.apply_test_out_result(uuid, text) to service_role;

-- submit_attempt -------------------------------------------------------------

create or replace function public.submit_attempt(
  p_attempt_id uuid,
  p_data_declaration boolean
)
returns public.attempts
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  att public.attempts;
  asm public.assessments;
  usr public.profiles;
  dept_match uuid;
  needs_marking boolean := false;
  item_rec record;
  resp public.responses;
  keys public.assessment_item_keys;
  chosen text;
  pts numeric;
  total_earned numeric := 0;
  total_max numeric := 0;
  pct numeric(5, 2);
  did_pass boolean;
  is_quiz boolean;
  rules jsonb;
  test_out_code text;
begin
  select * into att from public.attempts a where a.id = p_attempt_id;
  if not found then
    raise exception 'Attempt not found.' using errcode = '22023';
  end if;

  if att.user_id <> actor then
    raise exception 'You can only submit your own attempt.' using errcode = '42501';
  end if;

  if att.status <> 'in_progress' then
    raise exception 'This attempt has already been submitted.' using errcode = '22023';
  end if;

  select * into asm from public.assessments a where a.id = att.assessment_id;
  select * into usr from public.profiles p where p.id = att.user_id;

  is_quiz := asm.type in ('quiz', 'safety_quiz');

  if asm.type = 'placement' and not coalesce(p_data_declaration, false) then
    raise exception 'Confirm the data declaration before submitting.' using errcode = '22023';
  end if;

  if is_quiz then
    for item_rec in
      select i.*
      from public.assessment_items i
      where i.assessment_id = att.assessment_id
        and i.id = any (att.item_ids)
      order by i.sort_order, i.ref
    loop
      select * into resp
      from public.responses r
      where r.attempt_id = att.id and r.item_id = item_rec.id;

      if not found then
        insert into public.responses (attempt_id, item_id, answer)
        values (att.id, item_rec.id, '{}'::jsonb)
        returning * into resp;
      end if;

      select * into keys from public.assessment_item_keys k where k.item_id = item_rec.id;
      chosen := coalesce(resp.answer ->> 'option_id', resp.answer ->> 'id');
      pts := coalesce((keys.option_points ->> chosen)::numeric, 0);

      insert into public.response_scores (response_id, auto_score)
      values (resp.id, pts)
      on conflict (response_id) do update set
        auto_score = excluded.auto_score,
        updated_at = now();

      total_earned := total_earned + pts;
      total_max := total_max + coalesce(item_rec.points, 0);
    end loop;

    pct := case
      when total_max > 0 then round((total_earned / total_max) * 100, 2)
      else 0
    end;
    did_pass := pct >= coalesce(asm.pass_mark_pct, 0);

    update public.attempts a
    set
      status = 'marked'::public.attempt_status,
      submitted_at = now(),
      data_declaration = coalesce(p_data_declaration, false),
      percentage = pct,
      passed = did_pass,
      updated_at = now()
    where a.id = att.id
    returning * into att;

    if usr.stream is not null then
      select s.value into rules
      from public.app_settings s
      where s.key = 'plan.stream_rules';

      if rules is not null then
        select test_out.elem ->> 'code' into test_out_code
        from jsonb_array_elements(
          coalesce(rules -> 'streams' -> usr.stream::text -> 'test_outs', '[]'::jsonb)
        ) as test_out(elem)
        where test_out.elem ->> 'source_code' = asm.code
          and test_out.elem ->> 'via' = 'assessment'
        limit 1;

        if test_out_code is not null then
          perform public.apply_test_out_result(att.user_id, test_out_code);
        end if;
      end if;
    end if;

    return att;
  end if;

  dept_match := public.resolve_department_item_department_id(att.assessment_id, usr.department_id);
  if exists (
    select 1
    from public.assessment_sections s
    where s.assessment_id = att.assessment_id and s.code = 'department'
  ) and dept_match is null then
    raise exception
      'No department task is configured for your department. Contact a trainer.'
      using errcode = '22023';
  end if;

  for item_rec in
    select i.*, s.code as section_code
    from public.assessment_items i
    join public.assessment_sections s on s.id = i.section_id
    where i.assessment_id = att.assessment_id
      and public.attempt_item_applies(i, s.code, usr.department_id, dept_match)
  loop
    select * into resp
    from public.responses r
    where r.attempt_id = att.id and r.item_id = item_rec.id;

    if not found and item_rec.type <> 'profile' then
      insert into public.responses (attempt_id, item_id, answer)
      values (att.id, item_rec.id, '{}'::jsonb)
      returning * into resp;
    end if;

    if item_rec.type = 'choice' then
      select * into keys from public.assessment_item_keys k where k.item_id = item_rec.id;
      chosen := coalesce(resp.answer ->> 'option_id', resp.answer ->> 'id');
      pts := coalesce((keys.option_points ->> chosen)::numeric, 0);

      insert into public.response_scores (response_id, auto_score)
      values (resp.id, pts)
      on conflict (response_id) do update set
        auto_score = excluded.auto_score,
        updated_at = now();
    elsif item_rec.type in ('short_text', 'practical') then
      needs_marking := true;
    end if;
  end loop;

  update public.attempts a
  set
    status = case when needs_marking then 'marking'::public.attempt_status else 'marked'::public.attempt_status end,
    submitted_at = now(),
    data_declaration = coalesce(p_data_declaration, false),
    updated_at = now()
  where a.id = att.id
  returning * into att;

  return att;
end;
$$;

comment on function public.submit_attempt(uuid, boolean) is
  'Submits an attempt. Quizzes auto-score to marked with percentage and passed; test-out quizzes update the learner plan.';

-- Regenerate plans for confirmed placements ------------------------------------

do $$
declare
  r record;
begin
  perform set_config('app.migration_plan_regen', 'true', true);

  for r in
    select distinct pr.user_id
    from public.placement_results pr
    where pr.confirmed_at is not null
  loop
    perform public.generate_learner_plan(r.user_id);
  end loop;

  perform set_config('app.migration_plan_regen', '', true);
end;
$$;
