-- Purpose: read-only progress aggregates for /progress (Prompt 10).
-- Tables touched: profiles, departments, cohorts, cohort_breaks, modules, learner_plan,
--   lessons, lesson_progress, assessments, attempts, submissions, reviews, pages,
--   page_acknowledgements, placement_results.
-- Views: progress_person_public, progress_person_trainer, progress_department_summary,
--   progress_module_summary, progress_weekly_activity (security_invoker = true).
-- Helpers: security definer aggregates that honour can_view_user / has_role without
--   widening row-level policies on attempts, submissions or placement_results.

-- ---------------------------------------------------------------------------
-- Scope helpers
-- ---------------------------------------------------------------------------

create or replace function public.can_view_department(p_department_id uuid)
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
  if viewer_id is null or p_department_id is null then
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
      from scope_departments s
      where s.id = p_department_id
    );
  end if;

  return false;
end;
$$;

comment on function public.can_view_department(uuid) is
  'Whether the signed-in person may see department-scoped progress roll-ups.';

revoke execute on function public.can_view_department(uuid) from public, anon;
grant execute on function public.can_view_department(uuid) to authenticated, service_role;

create or replace function public._progress_require_can_view_user(p_user_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.can_view_user(p_user_id) then
    raise exception 'Not allowed to view this person''s progress.' using errcode = '42501';
  end if;
end;
$$;

revoke execute on function public._progress_require_can_view_user(uuid) from public, anon;
grant execute on function public._progress_require_can_view_user(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Programme week calendar (Malaysia dates, cohort breaks)
-- ---------------------------------------------------------------------------

create or replace function public._progress_monday_of_week(p_ymd date)
returns date
language sql
immutable
set search_path = ''
as $$
  select (p_ymd - ((extract(isodow from p_ymd)::integer + 6) % 7))::date;
$$;

create or replace function public._progress_break_covers_date(
  p_cohort_id uuid,
  p_ymd date
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.cohort_breaks cb
    where cb.cohort_id = p_cohort_id
      and p_ymd >= public._progress_monday_of_week(cb.start_date)
      and p_ymd <= (public._progress_monday_of_week(cb.start_date) + ((cb.weeks - 1) * 7) + 6)
  );
$$;

revoke execute on function public._progress_break_covers_date(uuid, date) from public, anon;
grant execute on function public._progress_break_covers_date(uuid, date) to authenticated, service_role;

create or replace function public._progress_programme_week_range(
  p_cohort_id uuid,
  p_week0_start date,
  p_programme_week integer
)
returns table (week_monday date, week_friday date)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  cursor_monday date;
  index integer := 0;
begin
  if p_week0_start is null or p_programme_week is null or p_programme_week < 0 then
    return;
  end if;

  cursor_monday := public._progress_monday_of_week(p_week0_start);

  while index <= p_programme_week loop
    if not public._progress_break_covers_date(p_cohort_id, cursor_monday) then
      if index = p_programme_week then
        week_monday := cursor_monday;
        week_friday := cursor_monday + 4;
        return next;
        return;
      end if;
      index := index + 1;
    end if;
    cursor_monday := cursor_monday + 7;
  end loop;
end;
$$;

comment on function public._progress_programme_week_range(uuid, date, integer) is
  'Monday–Friday calendar range for a programme week (respects cohort breaks).';

revoke execute on function public._progress_programme_week_range(uuid, date, integer) from public, anon;
grant execute on function public._progress_programme_week_range(uuid, date, integer) to authenticated, service_role;

create or replace function public._progress_working_days_malaysia(
  p_start timestamptz,
  p_end timestamptz
)
returns integer
language sql
immutable
set search_path = ''
as $$
  select count(*)::integer
  from generate_series(
    (p_start at time zone 'Asia/Kuala_Lumpur')::date + 1,
    (p_end at time zone 'Asia/Kuala_Lumpur')::date,
    interval '1 day'
  ) as g(d)
  where extract(isodow from g.d) between 1 and 5;
$$;

-- ---------------------------------------------------------------------------
-- Module completion (lessons + module quiz; matches My path today)
-- ---------------------------------------------------------------------------

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
begin
  perform public._progress_require_can_view_user(p_user_id);

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
    return coalesce(quiz_ok, false);
  end if;

  return published_lessons = 0 or completed_lessons >= published_lessons;
end;
$$;

comment on function public._progress_module_complete(uuid, uuid) is
  'Whether a person finished published lessons and passed the module quiz when one exists.';

revoke execute on function public._progress_module_complete(uuid, uuid) from public, anon;
grant execute on function public._progress_module_complete(uuid, uuid) to authenticated, service_role;

create or replace function public._progress_person_plan_counts(p_user_id uuid)
returns table (
  required_modules_done integer,
  required_modules_total integer,
  bridge_modules_done integer,
  bridge_modules_total integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  rec record;
  req_done integer := 0;
  req_total integer := 0;
  br_done integer := 0;
  br_total integer := 0;
begin
  perform public._progress_require_can_view_user(p_user_id);

  for rec in
    select lp.module_id, lp.status
    from public.learner_plan lp
    where lp.user_id = p_user_id
  loop
    if rec.status in ('required', 'test_out_pending', 'bridge') then
      req_total := req_total + 1;
      if public._progress_module_complete(p_user_id, rec.module_id) then
        req_done := req_done + 1;
      end if;
    end if;

    if rec.status = 'bridge' then
      br_total := br_total + 1;
      if public._progress_module_complete(p_user_id, rec.module_id) then
        br_done := br_done + 1;
      end if;
    end if;
  end loop;

  required_modules_done := req_done;
  required_modules_total := req_total;
  bridge_modules_done := br_done;
  bridge_modules_total := br_total;
  return next;
end;
$$;

revoke execute on function public._progress_person_plan_counts(uuid) from public, anon;
grant execute on function public._progress_person_plan_counts(uuid) to authenticated, service_role;

create or replace function public._progress_person_quiz_counts(p_user_id uuid)
returns table (quizzes_completed integer, quizzes_passed integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public._progress_require_can_view_user(p_user_id);

  return query
  select
    count(distinct a.assessment_id)::integer as quizzes_completed,
    count(distinct a.assessment_id) filter (where coalesce(a.passed, false))::integer as quizzes_passed
  from public.attempts a
  join public.assessments asm on asm.id = a.assessment_id
  where a.user_id = p_user_id
    and asm.type in ('quiz', 'safety_quiz')
    and asm.status = 'published'
    and a.status in ('submitted', 'marking', 'marked', 'confirmed');
end;
$$;

revoke execute on function public._progress_person_quiz_counts(uuid) from public, anon;
grant execute on function public._progress_person_quiz_counts(uuid) to authenticated, service_role;

create or replace function public._progress_person_assignment_counts(p_user_id uuid)
returns table (assignments_submitted integer, assignments_returned integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public._progress_require_can_view_user(p_user_id);

  return query
  select
    count(*)::integer as assignments_submitted,
    count(*) filter (where s.status = 'returned')::integer as assignments_returned
  from public.submissions s
  where s.user_id = p_user_id;
end;
$$;

revoke execute on function public._progress_person_assignment_counts(uuid) from public, anon;
grant execute on function public._progress_person_assignment_counts(uuid) to authenticated, service_role;

create or replace function public._progress_person_week0_status(p_user_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  placement_id uuid;
  has_attempt boolean;
  has_in_progress boolean;
  has_submitted boolean;
  has_confirmed boolean;
begin
  perform public._progress_require_can_view_user(p_user_id);

  select a.id
  into placement_id
  from public.assessments a
  where a.type = 'placement'
    and a.status = 'published'
  order by a.version desc
  limit 1;

  if placement_id is null then
    return 'not_started';
  end if;

  select
    exists (select 1 from public.attempts att where att.user_id = p_user_id and att.assessment_id = placement_id),
    exists (
      select 1 from public.attempts att
      where att.user_id = p_user_id and att.assessment_id = placement_id and att.status = 'in_progress'
    ),
    exists (
      select 1 from public.attempts att
      where att.user_id = p_user_id
        and att.assessment_id = placement_id
        and att.status in ('submitted', 'marking', 'marked', 'confirmed')
    ),
    exists (
      select 1
      from public.placement_results pr
      join public.attempts att on att.id = pr.attempt_id
      where pr.user_id = p_user_id
        and att.assessment_id = placement_id
        and pr.confirmed_at is not null
    )
  into has_attempt, has_in_progress, has_submitted, has_confirmed;

  if has_confirmed then
    return 'confirmed';
  end if;
  if has_submitted then
    return 'submitted';
  end if;
  if has_in_progress then
    return 'in_progress';
  end if;
  if has_attempt then
    return 'in_progress';
  end if;
  return 'not_started';
end;
$$;

revoke execute on function public._progress_person_week0_status(uuid) from public, anon;
grant execute on function public._progress_person_week0_status(uuid) to authenticated, service_role;

create or replace function public._progress_person_test_out_status(p_user_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public._progress_require_can_view_user(p_user_id);

  if exists (
    select 1 from public.learner_plan lp
    where lp.user_id = p_user_id and lp.status = 'test_out_pending'
  ) then
    return 'pending';
  end if;

  if exists (
    select 1 from public.learner_plan lp
    where lp.user_id = p_user_id and lp.reason ilike '%test-out not passed%'
  ) then
    return 'not_passed';
  end if;

  if exists (
    select 1 from public.learner_plan lp
    where lp.user_id = p_user_id and lp.reason ilike 'Passed %test-out%'
  ) then
    return 'passed';
  end if;

  return 'none';
end;
$$;

revoke execute on function public._progress_person_test_out_status(uuid) from public, anon;
grant execute on function public._progress_person_test_out_status(uuid) to authenticated, service_role;

create or replace function public._progress_trainer_week0_total(p_user_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select pr.total::text
      from public.placement_results pr
      join public.attempts att on att.id = pr.attempt_id
      join public.assessments asm on asm.id = att.assessment_id
      where pr.user_id = p_user_id
        and asm.type = 'placement'
        and pr.confirmed_at is not null
      order by pr.confirmed_at desc
      limit 1
    ),
    '—'
  )
  where (select public.has_role('trainer', 'admin'));
$$;

revoke execute on function public._progress_trainer_week0_total(uuid) from public, anon;
grant execute on function public._progress_trainer_week0_total(uuid) to authenticated, service_role;

create or replace function public._progress_trainer_quiz_summary(p_user_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select string_agg(
        asm.code || ': ' || coalesce(round(best.best_pct, 2)::text, '—') || '%',
        '; '
        order by asm.code
      )
      from public.assessments asm
      left join lateral (
        select max(att.percentage) as best_pct
        from public.attempts att
        where att.user_id = p_user_id
          and att.assessment_id = asm.id
          and att.percentage is not null
          and att.status in ('submitted', 'marking', 'marked', 'confirmed')
      ) best on true
      where asm.status = 'published'
        and asm.type in ('quiz', 'safety_quiz')
    ),
    '—'
  )
  where (select public.has_role('trainer', 'admin'))
    and public.can_view_user(p_user_id);
$$;

revoke execute on function public._progress_trainer_quiz_summary(uuid) from public, anon;
grant execute on function public._progress_trainer_quiz_summary(uuid) to authenticated, service_role;

create or replace function public._progress_trainer_assignment_marks_summary(p_user_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select string_agg(
        asg.code || ': ' || coalesce(win.total::text, '—'),
        '; '
        order by asg.code
      )
      from public.submissions sub
      join public.assignments asg on asg.id = sub.assignment_id
      left join lateral (
        select r.total
        from public.reviews r
        where r.submission_id = sub.id
          and r.released_at is not null
          and r.kind in ('final', 'primary')
        order by case when r.kind = 'final' then 0 else 1 end, r.created_at desc
        limit 1
      ) win on true
      where sub.user_id = p_user_id
        and sub.status = 'returned'
    ),
    '—'
  )
  where (select public.has_role('trainer', 'admin'))
    and public.can_view_user(p_user_id);
$$;

revoke execute on function public._progress_trainer_assignment_marks_summary(uuid) from public, anon;
grant execute on function public._progress_trainer_assignment_marks_summary(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Views
-- ---------------------------------------------------------------------------

create or replace view public.progress_person_public
with (security_invoker = true) as
select
  p.id as user_id,
  coalesce(nullif(btrim(p.full_name), ''), p.email) as person_name,
  d.name as department_name,
  d.id as department_id,
  c.name as cohort_name,
  p.cohort_id,
  p.stream::text as stream,
  p.is_test_account,
  p.last_seen_at,
  coalesce(pc.required_modules_done, 0) as required_modules_done,
  coalesce(pc.required_modules_total, 0) as required_modules_total,
  coalesce(pc.bridge_modules_done, 0) as bridge_modules_done,
  coalesce(pc.bridge_modules_total, 0) as bridge_modules_total,
  coalesce(public._progress_person_test_out_status(p.id), 'none') as test_out_status,
  coalesce(lc.lessons_completed, 0)::integer as lessons_completed,
  coalesce(qc.quizzes_completed, 0) as quizzes_completed,
  coalesce(qc.quizzes_passed, 0) as quizzes_passed,
  coalesce(ac.assignments_submitted, 0) as assignments_submitted,
  coalesce(ac.assignments_returned, 0) as assignments_returned,
  coalesce(dr.data_rules_confirmed, false) as data_rules_confirmed,
  dr.data_rules_version,
  coalesce(public._progress_person_week0_status(p.id), 'not_started') as week0_status
from public.profiles p
left join public.departments d on d.id = p.department_id
left join public.cohorts c on c.id = p.cohort_id
left join lateral public._progress_person_plan_counts(p.id) pc on true
left join lateral (
  select count(*)::integer as lessons_completed
  from public.lesson_progress lp
  where lp.user_id = p.id
) lc on true
left join lateral public._progress_person_quiz_counts(p.id) qc on true
left join lateral public._progress_person_assignment_counts(p.id) ac on true
left join lateral (
  select
    exists (
      select 1
      from public.page_acknowledgements pa
      join public.pages pg on pg.id = pa.page_id
      where pa.user_id = p.id
        and pg.slug = 'data-rules'
        and pg.status = 'published'
        and pa.version = pg.version
    ) as data_rules_confirmed,
    (
      select pa.version
      from public.page_acknowledgements pa
      join public.pages pg on pg.id = pa.page_id
      where pa.user_id = p.id
        and pg.slug = 'data-rules'
        and pg.status = 'published'
        and pa.version = pg.version
      order by pa.acknowledged_at desc
      limit 1
    ) as data_rules_version
) dr on true
where p.is_active
  and public.can_view_user(p.id);

comment on view public.progress_person_public is
  'Per-person progress counts without marks. Filter is_test_account in the app unless trainers include demo people.';

create or replace view public.progress_person_trainer
with (security_invoker = true) as
select
  pub.*,
  public._progress_trainer_week0_total(pub.user_id) as week0_total,
  public._progress_trainer_quiz_summary(pub.user_id) as quiz_best_summary,
  public._progress_trainer_assignment_marks_summary(pub.user_id) as assignment_marks_summary
from public.progress_person_public pub
where (select public.has_role('trainer', 'admin'));

comment on view public.progress_person_trainer is
  'Trainer/admin person progress with Week 0 total and mark summaries (no extra row access).';

create or replace view public.progress_department_summary
with (security_invoker = true) as
select
  d.id as department_id,
  d.name as department_name,
  count(*)::integer as people,
  count(*) filter (where pub.week0_status = 'not_started')::integer as week0_not_started,
  count(*) filter (where pub.week0_status = 'in_progress')::integer as week0_in_progress,
  count(*) filter (where pub.week0_status = 'submitted')::integer as week0_submitted,
  count(*) filter (where pub.week0_status = 'confirmed')::integer as week0_confirmed,
  count(*) filter (where pub.stream = 'foundation')::integer as stream_foundation,
  count(*) filter (where pub.stream = 'practitioner')::integer as stream_practitioner,
  count(*) filter (where pub.stream = 'practitioner_fast_track')::integer as stream_practitioner_fast_track,
  count(*) filter (where pub.stream = 'champion')::integer as stream_champion,
  coalesce(sum(pub.required_modules_done), 0)::integer as required_modules_done_sum,
  coalesce(sum(pub.required_modules_total), 0)::integer as required_modules_total_sum,
  count(*) filter (where pub.data_rules_confirmed)::integer as data_rules_confirmed_count,
  count(*) filter (
    where pub.last_seen_at is not null
      and pub.last_seen_at >= (now() - interval '7 days')
  )::integer as active_last_7_days
from public.departments d
join public.progress_person_public pub on pub.department_id = d.id
where not pub.is_test_account
group by d.id, d.name;

comment on view public.progress_department_summary is
  'Department roll-up from progress_person_public (test accounts excluded).';

create or replace view public.progress_module_summary
with (security_invoker = true) as
select
  m.id as module_id,
  m.code as module_code,
  m.title as module_title,
  count(distinct lp.user_id) filter (
    where lp.status in ('required', 'test_out_pending', 'bridge')
      and not coalesce(prf.is_test_account, false)
  )::integer as people_required,
  count(distinct lp.user_id) filter (
    where not coalesce(prf.is_test_account, false)
      and lp.status in ('required', 'bridge', 'test_out_pending')
      and public._progress_module_complete(lp.user_id, m.id)
  )::integer as people_done,
  count(distinct lp.user_id) filter (
    where lp.status = 'test_out_pending'
      and not coalesce(prf.is_test_account, false)
  )::integer as test_out_pending,
  coalesce(lc.lesson_completions, 0)::integer as lesson_completions,
  coalesce(qa.quiz_attempts, 0)::integer as quiz_attempts,
  coalesce(qp.quiz_passes, 0)::integer as quiz_passes,
  coalesce(sub.assignment_submissions, 0)::integer as assignment_submissions,
  coalesce(ret.assignment_returned, 0)::integer as assignment_returned,
  coalesce(res.resubmit_requested, 0)::integer as resubmit_requested,
  med.median_working_days_to_return
from public.modules m
left join public.learner_plan lp on lp.module_id = m.id
left join public.profiles prf on prf.id = lp.user_id and prf.is_active
left join lateral (
  select count(*)::integer as lesson_completions
  from public.lesson_progress lpr
  join public.lessons l on l.id = lpr.lesson_id
  join public.profiles p on p.id = lpr.user_id
  where l.module_id = m.id
    and l.status = 'published'
    and p.is_active
    and not coalesce(p.is_test_account, false)
) lc on true
left join lateral (
  select count(*)::integer as quiz_attempts
  from public.attempts a
  join public.assessments asm on asm.id = a.assessment_id
  join public.profiles p on p.id = a.user_id
  where asm.module_id = m.id
    and asm.type in ('quiz', 'safety_quiz')
    and asm.status = 'published'
    and a.status in ('submitted', 'marking', 'marked', 'confirmed')
    and not coalesce(p.is_test_account, false)
) qa on true
left join lateral (
  select count(*)::integer as quiz_passes
  from public.attempts a
  join public.assessments asm on asm.id = a.assessment_id
  join public.profiles p on p.id = a.user_id
  where asm.module_id = m.id
    and asm.type in ('quiz', 'safety_quiz')
    and asm.status = 'published'
    and coalesce(a.passed, false)
    and not coalesce(p.is_test_account, false)
) qp on true
left join lateral (
  select count(*)::integer as assignment_submissions
  from public.submissions s
  join public.assignments asg on asg.id = s.assignment_id
  join public.profiles p on p.id = s.user_id
  where asg.module_id = m.id
    and not coalesce(p.is_test_account, false)
) sub on true
left join lateral (
  select count(*)::integer as assignment_returned
  from public.submissions s
  join public.assignments asg on asg.id = s.assignment_id
  join public.profiles p on p.id = s.user_id
  where asg.module_id = m.id
    and s.status = 'returned'
    and not coalesce(p.is_test_account, false)
) ret on true
left join lateral (
  select count(*)::integer as resubmit_requested
  from public.submissions s
  join public.assignments asg on asg.id = s.assignment_id
  join public.profiles p on p.id = s.user_id
  where asg.module_id = m.id
    and s.status = 'resubmit_requested'
    and not coalesce(p.is_test_account, false)
) res on true
left join lateral (
  select percentile_cont(0.5) within group (order by wd.days)::numeric(10, 1) as median_working_days_to_return
  from (
    select public._progress_working_days_malaysia(s.submitted_at, win.released_at) as days
    from public.submissions s
    join public.assignments asg on asg.id = s.assignment_id
    join public.profiles p on p.id = s.user_id
    left join lateral (
      select r.released_at
      from public.reviews r
      where r.submission_id = s.id
        and r.released_at is not null
        and r.kind in ('final', 'primary')
      order by case when r.kind = 'final' then 0 else 1 end, r.created_at desc
      limit 1
    ) win on true
    where asg.module_id = m.id
      and s.status = 'returned'
      and win.released_at is not null
      and not coalesce(p.is_test_account, false)
  ) wd
) med on true
group by
  m.id,
  m.code,
  m.title,
  lc.lesson_completions,
  qa.quiz_attempts,
  qp.quiz_passes,
  sub.assignment_submissions,
  ret.assignment_returned,
  res.resubmit_requested,
  med.median_working_days_to_return;

comment on view public.progress_module_summary is
  'Per-module completion counts; quiz pass and median return days are trainer-facing columns.';

create or replace view public.progress_weekly_activity
with (security_invoker = true) as
select
  c.id as cohort_id,
  c.name as cohort_name,
  w.programme_week,
  count(distinct act.user_id) filter (where act.is_active)::integer as people_active,
  coalesce(sum(act.lessons_completed), 0)::integer as lessons_completed,
  coalesce(sum(act.quizzes_submitted), 0)::integer as quizzes_submitted,
  coalesce(sum(act.assignments_submitted), 0)::integer as assignments_submitted,
  coalesce(sum(act.feedback_released), 0)::integer as feedback_released
from public.cohorts c
cross join generate_series(0, 20) as w(programme_week)
left join lateral public._progress_programme_week_range(c.id, c.week0_start_date, w.programme_week) wk on true
left join lateral (
  select
    p.id as user_id,
    (
      coalesce(lp.lessons_completed, 0) > 0
      or coalesce(qz.quizzes_submitted, 0) > 0
      or coalesce(sb.assignments_submitted, 0) > 0
      or coalesce(fb.feedback_released, 0) > 0
      or (
        p.last_seen_at is not null
        and wk.week_monday is not null
        and (p.last_seen_at at time zone 'Asia/Kuala_Lumpur')::date between wk.week_monday and wk.week_friday
      )
    ) as is_active,
    coalesce(lp.lessons_completed, 0)::integer as lessons_completed,
    coalesce(qz.quizzes_submitted, 0)::integer as quizzes_submitted,
    coalesce(sb.assignments_submitted, 0)::integer as assignments_submitted,
    coalesce(fb.feedback_released, 0)::integer as feedback_released
  from public.profiles p
  left join lateral (
    select count(*)::integer as lessons_completed
    from public.lesson_progress lpr
    where lpr.user_id = p.id
      and wk.week_monday is not null
      and (lpr.completed_at at time zone 'Asia/Kuala_Lumpur')::date between wk.week_monday and wk.week_friday
  ) lp on true
  left join lateral (
    select count(*)::integer as quizzes_submitted
    from public.attempts att
    join public.assessments asm on asm.id = att.assessment_id
    where att.user_id = p.id
      and asm.type in ('quiz', 'safety_quiz')
      and att.submitted_at is not null
      and wk.week_monday is not null
      and (att.submitted_at at time zone 'Asia/Kuala_Lumpur')::date between wk.week_monday and wk.week_friday
  ) qz on true
  left join lateral (
    select count(*)::integer as assignments_submitted
    from public.submissions s
    where s.user_id = p.id
      and wk.week_monday is not null
      and (s.submitted_at at time zone 'Asia/Kuala_Lumpur')::date between wk.week_monday and wk.week_friday
  ) sb on true
  left join lateral (
    select count(*)::integer as feedback_released
    from public.submissions s
    join public.reviews r on r.submission_id = s.id
    where s.user_id = p.id
      and s.status = 'returned'
      and r.released_at is not null
      and r.kind in ('final', 'primary')
      and wk.week_monday is not null
      and (r.released_at at time zone 'Asia/Kuala_Lumpur')::date between wk.week_monday and wk.week_friday
  ) fb on true
  where p.cohort_id = c.id
    and p.is_active
    and not coalesce(p.is_test_account, false)
) act on wk.week_monday is not null
where c.week0_start_date is not null
group by c.id, c.name, w.programme_week;

comment on view public.progress_weekly_activity is
  'Weekly activity counts per cohort programme week (Malaysia dates, cohort breaks).';

-- ---------------------------------------------------------------------------
-- Grants (security_invoker views; row scope enforced in view predicates and
-- underlying table RLS — Postgres does not support RLS policies on views here)
-- ---------------------------------------------------------------------------

grant select on public.progress_person_public to authenticated, service_role;
grant select on public.progress_person_trainer to authenticated, service_role;
grant select on public.progress_department_summary to authenticated, service_role;
grant select on public.progress_module_summary to authenticated, service_role;
grant select on public.progress_weekly_activity to authenticated, service_role;
