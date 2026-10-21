-- Purpose: Module quizzes, attempt review, trainer quiz analytics, and related fixes.
-- Tables touched: profiles, assessment_items, assessments, attempts.
-- Functions replaced: start_attempt, submit_attempt.
-- Functions added: get_attempt_review, get_quiz_results_summary, get_quiz_question_stats.
-- Prompt: 07b (fixes + module quizzes).

-- profiles: durable test-account flag ----------------------------------------

alter table public.profiles
  add column if not exists is_test_account boolean not null default false;

comment on column public.profiles.is_test_account is
  'When true, exclude this person from trainer user totals, placements lists, and quiz analytics.';

-- assessment_items: multi-select profile questions -----------------------------

alter table public.assessment_items
  add column if not exists allow_multiple boolean not null default false;

comment on column public.assessment_items.allow_multiple is
  'Profile items only: learner may select more than one option (stored in responses.answer.option_ids).';

alter table public.assessment_items
  add constraint assessment_items_allow_multiple_profile_only
  check (allow_multiple = false or type = 'profile');

-- assessments: quiz settings -------------------------------------------------

alter table public.assessments
  rename column pass_mark to pass_mark_pct;

comment on column public.assessments.pass_mark_pct is
  'Pass threshold as a percentage (0–100). Required for quiz types; optional for placement.';

alter table public.assessments
  add column if not exists max_attempts integer
    check (max_attempts is null or max_attempts >= 1),
  add column if not exists show_review_after_submit boolean not null default true,
  add column if not exists items_per_attempt integer
    check (items_per_attempt is null or items_per_attempt >= 1);

comment on column public.assessments.max_attempts is
  'Maximum completed attempts per person. Null means unlimited (module quizzes).';
comment on column public.assessments.show_review_after_submit is
  'When true, learners may call get_attempt_review after submit. Always false for placement.';
comment on column public.assessments.items_per_attempt is
  'Random draw size from the choice-item pool per attempt. Null means all choice items.';

update public.assessments a
set show_review_after_submit = false
where a.type = 'placement';

alter table public.assessments
  add constraint assessments_placement_no_review_after_submit
  check (type <> 'placement' or show_review_after_submit = false);

-- attempts: quiz draw and outcomes -------------------------------------------

alter table public.attempts
  add column if not exists item_ids uuid[] not null default '{}',
  add column if not exists percentage numeric(5, 2)
    check (percentage is null or (percentage >= 0 and percentage <= 100)),
  add column if not exists passed boolean;

comment on column public.attempts.item_ids is
  'Choice items drawn for this attempt (quizzes). Empty for placement.';
comment on column public.attempts.percentage is
  'Auto-scored percentage for quiz and safety_quiz attempts.';
comment on column public.attempts.passed is
  'Whether percentage met pass_mark_pct on submit (quizzes).';

create index if not exists attempts_assessment_user_status_idx
  on public.attempts (assessment_id, user_id, status);

-- Helpers --------------------------------------------------------------------

create or replace function public._option_text_from_options(
  p_options jsonb,
  p_option_id text
)
returns text
language sql
immutable
set search_path = ''
as $$
  select elem ->> 'text'
  from jsonb_array_elements(coalesce(p_options, '[]'::jsonb)) as elem
  where elem ->> 'id' = p_option_id
  limit 1;
$$;

comment on function public._option_text_from_options(jsonb, text) is
  'Resolves learner-facing option label from assessment_items.options.';

create or replace function public._correct_option_id_from_points(p_option_points jsonb)
returns text
language sql
immutable
set search_path = ''
as $$
  select key
  from jsonb_each_text(coalesce(p_option_points, '{}'::jsonb)) as kv(key, value)
  order by (value)::numeric desc nulls last, key
  limit 1;
$$;

comment on function public._correct_option_id_from_points(jsonb) is
  'Highest-scoring option id in assessment_item_keys.option_points.';

revoke execute on function public._option_text_from_options(jsonb, text) from public, anon, authenticated;
revoke execute on function public._correct_option_id_from_points(jsonb) from public, anon, authenticated;

-- start_attempt --------------------------------------------------------------

create or replace function public.start_attempt(p_assessment_id uuid)
returns public.attempts
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  asm public.assessments;
  existing public.attempts;
  completed public.attempts;
  new_attempt public.attempts;
  choice_meta jsonb := '{}'::jsonb;
  item_rec record;
  opt_ids jsonb;
  retake_granted_by uuid;
  completed_attempt_id uuid;
  completed_count integer := 0;
  drawn_ids uuid[];
  is_quiz boolean;
begin
  if actor is null or (select public.current_app_role()) is null then
    raise exception 'Sign in with an active account.' using errcode = '42501';
  end if;

  select * into asm
  from public.assessments a
  where a.id = p_assessment_id and a.status = 'published';

  if not found then
    raise exception 'Assessment is not available.' using errcode = '22023';
  end if;

  is_quiz := asm.type in ('quiz', 'safety_quiz');

  select * into existing
  from public.attempts a
  where a.user_id = actor
    and a.assessment_id = p_assessment_id
    and a.status = 'in_progress'
  limit 1;

  if found then
    return existing;
  end if;

  select count(*)::integer into completed_count
  from public.attempts a
  where a.user_id = actor
    and a.assessment_id = p_assessment_id
    and a.status in ('submitted', 'marking', 'marked', 'confirmed');

  select * into completed
  from public.attempts a
  where a.user_id = actor
    and a.assessment_id = p_assessment_id
    and a.status in ('submitted', 'marking', 'marked', 'confirmed')
  order by a.started_at desc
  limit 1;

  if found then
    if coalesce(completed.meta ->> 'retake_allowed', 'false') = 'true' then
      retake_granted_by := nullif(completed.meta ->> 'retake_allowed_by', '')::uuid;
      completed_attempt_id := completed.id;
    elsif is_quiz then
      if asm.max_attempts is not null and completed_count >= asm.max_attempts then
        raise exception 'You have used all attempts for this quiz. Ask a trainer for a retake.'
          using errcode = '22023';
      end if;
    else
      raise exception 'You have already completed this assessment. Ask a trainer for a retake.'
        using errcode = '22023';
    end if;
  end if;

  if is_quiz then
    if asm.items_per_attempt is not null then
      select coalesce(array_agg(sub.id), '{}'::uuid[]) into drawn_ids
      from (
        select i.id
        from public.assessment_items i
        where i.assessment_id = p_assessment_id
          and i.type = 'choice'
        order by random()
        limit asm.items_per_attempt
      ) as sub;

      if coalesce(array_length(drawn_ids, 1), 0) < asm.items_per_attempt then
        raise exception 'This quiz does not have enough questions to start an attempt.'
          using errcode = '22023';
      end if;
    else
      select coalesce(array_agg(i.id order by i.sort_order, i.ref), '{}'::uuid[]) into drawn_ids
      from public.assessment_items i
      where i.assessment_id = p_assessment_id
        and i.type = 'choice';
    end if;

    if coalesce(array_length(drawn_ids, 1), 0) = 0 then
      raise exception 'This quiz has no questions.' using errcode = '22023';
    end if;

    for item_rec in
      select i.id, i.options
      from public.assessment_items i
      where i.id = any (drawn_ids)
        and jsonb_array_length(coalesce(i.options, '[]'::jsonb)) > 0
    loop
      select jsonb_agg(elem ->> 'id' order by random()) into opt_ids
      from jsonb_array_elements(item_rec.options) as elem;

      choice_meta := choice_meta || jsonb_build_object(item_rec.id::text, opt_ids);
    end loop;
  else
    drawn_ids := '{}'::uuid[];

    for item_rec in
      select i.id, i.options
      from public.assessment_items i
      where i.assessment_id = p_assessment_id
        and i.type = 'choice'
        and jsonb_array_length(coalesce(i.options, '[]'::jsonb)) > 0
    loop
      select jsonb_agg(elem ->> 'id' order by random()) into opt_ids
      from jsonb_array_elements(item_rec.options) as elem;

      choice_meta := choice_meta || jsonb_build_object(item_rec.id::text, opt_ids);
    end loop;
  end if;

  insert into public.attempts (user_id, assessment_id, allowed_by, meta, item_ids)
  values (
    actor,
    p_assessment_id,
    retake_granted_by,
    jsonb_build_object('option_order', choice_meta),
    drawn_ids
  )
  returning * into new_attempt;

  if completed_attempt_id is not null then
    update public.attempts a
    set meta = a.meta - 'retake_allowed' - 'retake_reason' - 'retake_allowed_by' - 'retake_allowed_at'
    where a.id = completed_attempt_id;
  end if;

  return new_attempt;
end;
$$;

comment on function public.start_attempt(uuid) is
  'Starts or resumes an attempt; enforces max_attempts for quizzes; draws item_ids and shuffles options.';

-- submit_attempt ---------------------------------------------------------------

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
  'Submits an attempt. Quizzes auto-score to marked with percentage and passed; placement unchanged.';

-- get_attempt_review -----------------------------------------------------------

create or replace function public.get_attempt_review(p_attempt_id uuid)
returns table (
  item_id uuid,
  prompt_md text,
  chosen_option_id text,
  chosen_text text,
  correct_option_id text,
  correct_text text,
  explanation_md text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  att public.attempts;
  asm public.assessments;
  item_rec record;
  keys public.assessment_item_keys;
  resp public.responses;
  chosen text;
  correct_id text;
  order_ids jsonb;
  display_options jsonb;
  opt_id text;
begin
  if actor is null then
    raise exception 'Sign in to view your review.' using errcode = '42501';
  end if;

  select * into att from public.attempts a where a.id = p_attempt_id;
  if not found then
    raise exception 'Attempt not found.' using errcode = '22023';
  end if;

  if att.user_id <> actor then
    raise exception 'You can only review your own attempts.' using errcode = '42501';
  end if;

  if att.submitted_at is null then
    raise exception 'Submit the attempt before viewing a review.' using errcode = '22023';
  end if;

  select * into asm from public.assessments a where a.id = att.assessment_id;

  if asm.type = 'placement' then
    raise exception 'Review is not available for this assessment.' using errcode = '22023';
  end if;

  if not asm.show_review_after_submit then
    raise exception 'Review is not enabled for this assessment.' using errcode = '22023';
  end if;

  for item_rec in
    select i.*
    from public.assessment_items i
    where i.assessment_id = att.assessment_id
      and (
        coalesce(array_length(att.item_ids, 1), 0) = 0
        or i.id = any (att.item_ids)
      )
    order by i.sort_order, i.ref
  loop
    select * into resp
    from public.responses r
    where r.attempt_id = att.id and r.item_id = item_rec.id;

    select * into keys from public.assessment_item_keys k where k.item_id = item_rec.id;

    chosen := coalesce(resp.answer ->> 'option_id', resp.answer ->> 'id');
    correct_id := public._correct_option_id_from_points(keys.option_points);

    order_ids := att.meta -> 'option_order' -> (item_rec.id::text);
    if order_ids is not null and jsonb_typeof(order_ids) = 'array' then
      display_options := '[]'::jsonb;
      for opt_id in
        select elem #>> '{}'
        from jsonb_array_elements(order_ids) as elem
      loop
        display_options := display_options || jsonb_build_array(
          (
            select opt
            from jsonb_array_elements(item_rec.options) as opt
            where opt ->> 'id' = opt_id
            limit 1
          )
        );
      end loop;
    else
      display_options := coalesce(item_rec.options, '[]'::jsonb);
    end if;

    item_id := item_rec.id;
    prompt_md := item_rec.prompt_md;
    chosen_option_id := chosen;
    chosen_text := public._option_text_from_options(display_options, chosen);
    correct_option_id := correct_id;
    correct_text := public._option_text_from_options(display_options, correct_id);
    explanation_md := coalesce(keys.explanation_md, '');
    return next;
  end loop;
end;
$$;

comment on function public.get_attempt_review(uuid) is
  'Learner-only post-submit review with correct answers when show_review_after_submit is true.';

-- get_quiz_results_summary -----------------------------------------------------

create or replace function public.get_quiz_results_summary()
returns table (
  user_id uuid,
  full_name text,
  email text,
  department_code text,
  assessment_id uuid,
  assessment_code text,
  assessment_title text,
  assessment_type public.assessment_type,
  pass_mark_pct integer,
  max_attempts integer,
  attempts_used bigint,
  best_percentage numeric(5, 2),
  passed boolean,
  first_pass_at timestamptz,
  last_attempt_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_trainer_or_admin();

  return query
  with completed as (
    select
      a.user_id,
      a.assessment_id,
      a.percentage,
      a.passed,
      a.submitted_at
    from public.attempts a
    join public.profiles p on p.id = a.user_id
    join public.assessments asm on asm.id = a.assessment_id
    where asm.type in ('quiz', 'safety_quiz')
      and asm.status = 'published'
      and coalesce(p.is_test_account, false) = false
      and a.status in ('submitted', 'marking', 'marked', 'confirmed')
      and a.submitted_at is not null
  ),
  agg as (
    select
      c.user_id,
      c.assessment_id,
      count(*)::bigint as attempts_used,
      max(c.percentage) as best_percentage,
      bool_or(coalesce(c.passed, false)) as passed,
      min(c.submitted_at) filter (where coalesce(c.passed, false)) as first_pass_at,
      max(c.submitted_at) as last_attempt_at
    from completed c
    group by c.user_id, c.assessment_id
  )
  select
    agg.user_id,
    p.full_name,
    p.email,
    d.code as department_code,
    asm.id as assessment_id,
    asm.code as assessment_code,
    asm.title as assessment_title,
    asm.type as assessment_type,
    asm.pass_mark_pct,
    asm.max_attempts,
    agg.attempts_used,
    agg.best_percentage,
    coalesce(agg.passed, false) as passed,
    agg.first_pass_at,
    agg.last_attempt_at
  from agg
  join public.profiles p on p.id = agg.user_id
  join public.assessments asm on asm.id = agg.assessment_id
  left join public.departments d on d.id = p.department_id
  order by asm.code, p.full_name;
end;
$$;

comment on function public.get_quiz_results_summary() is
  'Trainer/admin: per person and quiz aggregates; excludes is_test_account profiles.';

-- get_quiz_question_stats ------------------------------------------------------

create or replace function public.get_quiz_question_stats(p_assessment_id uuid)
returns table (
  item_id uuid,
  item_ref text,
  prompt_md text,
  sort_order integer,
  answered_count bigint,
  option_counts jsonb
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  asm public.assessments;
begin
  perform public.require_trainer_or_admin();

  select * into asm from public.assessments a where a.id = p_assessment_id;
  if not found then
    raise exception 'Assessment not found.' using errcode = '22023';
  end if;

  if asm.type not in ('quiz', 'safety_quiz') then
    raise exception 'Question check is only available for module quizzes.' using errcode = '22023';
  end if;

  return query
  with items as (
    select i.id, i.ref, i.prompt_md, i.sort_order, i.options
    from public.assessment_items i
    where i.assessment_id = p_assessment_id
      and i.type = 'choice'
  ),
  relevant_attempts as (
    select a.id
    from public.attempts a
    join public.profiles p on p.id = a.user_id
    where a.assessment_id = p_assessment_id
      and coalesce(p.is_test_account, false) = false
      and a.status in ('submitted', 'marking', 'marked', 'confirmed')
  ),
  responses_for_stats as (
    select r.item_id, r.answer
    from public.responses r
    join relevant_attempts ra on ra.id = r.attempt_id
  ),
  answered as (
    select
      rfs.item_id,
      count(*)::bigint as answered_count
    from responses_for_stats rfs
    where coalesce(rfs.answer ->> 'option_id', rfs.answer ->> 'id', '') <> ''
    group by rfs.item_id
  ),
  option_rows as (
    select
      it.id as item_id,
      opt.elem ->> 'id' as option_id,
      count(rfs.item_id)::bigint as chosen_count
    from items it
    cross join lateral jsonb_array_elements(coalesce(it.options, '[]'::jsonb)) as opt(elem)
    left join responses_for_stats rfs
      on rfs.item_id = it.id
      and coalesce(rfs.answer ->> 'option_id', rfs.answer ->> 'id') = (opt.elem ->> 'id')
    group by it.id, opt.elem ->> 'id'
  ),
  option_agg as (
    select
      orow.item_id,
      jsonb_object_agg(orow.option_id, orow.chosen_count order by orow.option_id) as option_counts
    from option_rows orow
    where orow.option_id is not null
    group by orow.item_id
  )
  select
    it.id as item_id,
    it.ref as item_ref,
    it.prompt_md,
    it.sort_order,
    coalesce(ans.answered_count, 0::bigint) as answered_count,
    coalesce(oa.option_counts, '{}'::jsonb) as option_counts
  from items it
  left join answered ans on ans.item_id = it.id
  left join option_agg oa on oa.item_id = it.id
  order by it.sort_order, it.ref;
end;
$$;

comment on function public.get_quiz_question_stats(uuid) is
  'Trainer/admin: per-item response totals and option counts for a quiz (excludes test accounts).';

-- Grants ---------------------------------------------------------------------

revoke execute on function public.get_attempt_review(uuid) from public, anon;
revoke execute on function public.get_quiz_results_summary() from public, anon;
revoke execute on function public.get_quiz_question_stats(uuid) from public, anon;

grant execute on function public.get_attempt_review(uuid) to authenticated;
grant execute on function public.get_quiz_results_summary() to authenticated;
grant execute on function public.get_quiz_question_stats(uuid) to authenticated;
