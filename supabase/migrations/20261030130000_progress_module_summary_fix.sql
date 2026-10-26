-- Progress › Modules: module roll-ups must not raise 42501 when a learner_plan row
-- references someone the viewer cannot see (inactive, out of scope, or missing profile).
-- Return "not complete" instead of aborting the whole query.

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
  if p_user_id is null or not public.can_view_user(p_user_id) then
    return false;
  end if;

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
  'Whether a person finished published lessons and passed the module quiz when one exists. Returns false when the viewer may not see that person.';
