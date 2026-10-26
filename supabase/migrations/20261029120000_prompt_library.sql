-- Prompt 12: review fixes, prompt library, acknowledgement_label on pages.
-- Tables: prompts, prompt_feedback, prompt_copies; enums; RLS; workflow functions.

-- ---------------------------------------------------------------------------
-- Part A: pages acknowledgement_label
-- ---------------------------------------------------------------------------

alter table public.pages
  add column if not exists acknowledgement_label text not null default 'I have read and will follow these rules';

comment on column public.pages.acknowledgement_label is
  'Checkbox label when requires_acknowledgement is true.';

update public.pages
set acknowledgement_label = 'I have read this privacy notice'
where slug = 'privacy';

-- ---------------------------------------------------------------------------
-- Part A: last admin leaver guard
-- ---------------------------------------------------------------------------

create or replace function public.admin_mark_leaver(
  p_user_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
begin
  if not (select public.has_role('admin')) then
    raise exception 'Only an admin can mark someone as a leaver.' using errcode = '42501';
  end if;
  if p_reason is null or length(trim(p_reason)) < 10 then
    raise exception 'A reason of at least 10 characters is required.' using errcode = 'P0001';
  end if;
  if p_user_id = v_actor then
    raise exception 'You cannot mark yourself as a leaver through this action.' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.profiles p
    where p.id = p_user_id and p.role = 'admin' and p.is_active
  ) and not exists (
    select 1 from public.profiles p
    where p.role = 'admin' and p.is_active and p.id <> p_user_id
  ) then
    raise exception 'Cannot mark the last active admin as a leaver. Make someone else an admin first.'
      using errcode = '42501';
  end if;

  perform set_config('app.change_reason', left(trim(p_reason), 500), true);

  update public.profiles
  set is_active = false,
      left_at = coalesce(left_at, (current_timestamp at time zone 'Asia/Kuala_Lumpur')::date),
      updated_at = now()
  where id = p_user_id;
end;
$$;

revoke all on function public.admin_mark_leaver(uuid, text) from public;
grant execute on function public.admin_mark_leaver(uuid, text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Part B: enums
-- ---------------------------------------------------------------------------

create type public.prompt_status as enum ('draft', 'in_review', 'tested', 'retired');
create type public.ai_tool as enum ('claude', 'perplexity', 'chatgpt');
create type public.risk_tier as enum ('low', 'medium', 'high');
create type public.prompt_feedback_outcome as enum ('worked', 'needed_edits', 'did_not_work');

alter type public.content_type add value if not exists 'prompt';

-- ---------------------------------------------------------------------------
-- Part B: prompts and related tables
-- ---------------------------------------------------------------------------

create table public.prompts (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  department_id uuid references public.departments (id) on delete set null,
  task_type text not null,
  tool public.ai_tool not null,
  module_id uuid references public.modules (id) on delete set null,
  risk_tier public.risk_tier not null default 'low',
  body text not null,
  usage_notes_md text not null default '',
  example_md text not null default '',
  version integer not null default 1 check (version >= 1),
  owner_id uuid references public.profiles (id) on delete set null,
  status public.prompt_status not null default 'draft',
  submitted_by uuid references public.profiles (id) on delete set null,
  submit_notes_md text,
  tested_by uuid references public.profiles (id) on delete set null,
  tested_at timestamptz,
  test_notes_md text,
  tasks_tried_count integer check (tasks_tried_count is null or tasks_tried_count >= 0),
  retired_reason text,
  is_sample boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.prompts is 'Prompt library entries (draft through tested).';

create table public.prompt_feedback (
  id uuid primary key default gen_random_uuid(),
  prompt_id uuid not null references public.prompts (id) on delete cascade,
  prompt_version integer not null,
  user_id uuid not null references public.profiles (id) on delete cascade,
  outcome public.prompt_feedback_outcome not null,
  comment text check (comment is null or char_length(comment) <= 500),
  declaration boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.prompt_copies (
  id uuid primary key default gen_random_uuid(),
  prompt_id uuid not null references public.prompts (id) on delete cascade,
  prompt_version integer not null,
  user_id uuid not null references public.profiles (id) on delete cascade,
  copied_at timestamptz not null default now()
);

create index prompts_status_idx on public.prompts (status);
create index prompts_department_id_idx on public.prompts (department_id);
create index prompts_task_type_idx on public.prompts (task_type);
create index prompt_feedback_prompt_id_idx on public.prompt_feedback (prompt_id);
create index prompt_copies_prompt_id_idx on public.prompt_copies (prompt_id);

create trigger prompts_set_updated_at before update on public.prompts
  for each row execute function public.set_updated_at();

create trigger prompts_audit_row_change after insert or update or delete on public.prompts
  for each row execute function public.audit_row_change();

-- Manager-safe aggregate counts (no comments or names)
create view public.prompt_feedback_manager_counts as
select
  pf.prompt_id,
  pf.prompt_version,
  pf.outcome,
  count(*)::bigint as feedback_count
from public.prompt_feedback pf
group by pf.prompt_id, pf.prompt_version, pf.outcome;

comment on view public.prompt_feedback_manager_counts is
  'Managers may read outcome counts only; no user ids or comments.';

create view public.prompt_copy_manager_counts as
select
  pc.prompt_id,
  pc.prompt_version,
  count(*)::bigint as copy_count
from public.prompt_copies pc
group by pc.prompt_id, pc.prompt_version;

comment on view public.prompt_copy_manager_counts is
  'Managers may read copy counts only; no user ids.';

-- Task types setting
insert into public.app_settings (key, value, note)
values (
  'library.task_types',
  '["research","drafting","editing","summarising","analysis","reporting","planning","ideation","quality check","meeting notes"]'::jsonb,
  'PROPOSED: allowed task_type values for the prompt library.'
)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- Workflow functions
-- ---------------------------------------------------------------------------

create function public.submit_prompt_for_review(
  p_prompt_id uuid,
  p_notes text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  pr public.prompts;
  dept uuid;
begin
  select department_id into dept from public.profiles where id = actor;
  select * into pr from public.prompts where id = p_prompt_id;
  if not found then
    raise exception 'Prompt not found.' using errcode = '22023';
  end if;
  if pr.status <> 'draft' then
    raise exception 'Only drafts can be submitted for review.' using errcode = '22023';
  end if;
  if (select public.has_role('trainer', 'admin')) then
    null;
  elsif (select public.has_role('champion')) then
    if pr.department_id is distinct from dept then
      raise exception 'Champions may only submit prompts for their own department.' using errcode = '42501';
    end if;
    if pr.owner_id is distinct from actor and pr.submitted_by is distinct from actor then
      raise exception 'Champions may only submit their own drafts.' using errcode = '42501';
    end if;
  else
    raise exception 'You cannot submit prompts for review.' using errcode = '42501';
  end if;

  update public.prompts
  set status = 'in_review',
      submitted_by = actor,
      submit_notes_md = nullif(btrim(p_notes), ''),
      updated_at = now()
  where id = p_prompt_id;
end;
$$;

create function public.mark_prompt_tested(
  p_prompt_id uuid,
  p_test_notes text,
  p_tasks_tried integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
begin
  if not (select public.has_role('trainer', 'admin')) then
    raise exception 'Only trainers and admins can mark prompts as tested.' using errcode = '42501';
  end if;
  if p_test_notes is null or length(trim(p_test_notes)) < 10 then
    raise exception 'Test notes of at least 10 characters are required.' using errcode = 'P0001';
  end if;
  if p_tasks_tried is null or p_tasks_tried < 3 then
    raise exception 'Record at least three sample tasks tried.' using errcode = 'P0001';
  end if;

  update public.prompts
  set status = 'tested',
      tested_by = actor,
      tested_at = now(),
      test_notes_md = left(trim(p_test_notes), 4000),
      tasks_tried_count = p_tasks_tried,
      updated_at = now()
  where id = p_prompt_id and status in ('in_review', 'draft');

  if not found then
    raise exception 'Prompt must be in review (or draft for trainers).' using errcode = '22023';
  end if;
end;
$$;

create function public.retire_prompt(
  p_prompt_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select public.has_role('trainer', 'admin')) then
    raise exception 'Only trainers and admins can retire prompts.' using errcode = '42501';
  end if;
  if p_reason is null or length(trim(p_reason)) < 10 then
    raise exception 'A retirement reason of at least 10 characters is required.' using errcode = 'P0001';
  end if;

  update public.prompts
  set status = 'retired',
      retired_reason = left(trim(p_reason), 500),
      updated_at = now()
  where id = p_prompt_id and status <> 'retired';

  if not found then
    raise exception 'Prompt not found or already retired.' using errcode = '22023';
  end if;
end;
$$;

create function public.log_prompt_copy(
  p_prompt_id uuid,
  p_prompt_version integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
begin
  if actor is null then
    raise exception 'Sign in required.' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.prompts p
    where p.id = p_prompt_id and p.version = p_prompt_version and p.status = 'tested'
  ) then
    raise exception 'Only tested prompts can be copied.' using errcode = '22023';
  end if;

  insert into public.prompt_copies (prompt_id, prompt_version, user_id)
  values (p_prompt_id, p_prompt_version, actor);
end;
$$;

create function public.give_prompt_feedback(
  p_prompt_id uuid,
  p_prompt_version integer,
  p_outcome public.prompt_feedback_outcome,
  p_comment text,
  p_declaration boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
begin
  if actor is null then
    raise exception 'Sign in required.' using errcode = '42501';
  end if;
  if not p_declaration then
    raise exception 'Confirm that your comment does not include client data.' using errcode = 'P0001';
  end if;
  if p_comment is not null and char_length(p_comment) > 500 then
    raise exception 'Comments are limited to 500 characters.' using errcode = 'P0001';
  end if;
  if not exists (
    select 1 from public.prompts p
    where p.id = p_prompt_id and p.version = p_prompt_version and p.status = 'tested'
  ) then
    raise exception 'Feedback is only allowed on the current tested version.' using errcode = '22023';
  end if;

  insert into public.prompt_feedback (prompt_id, prompt_version, user_id, outcome, comment, declaration)
  values (p_prompt_id, p_prompt_version, actor, p_outcome, nullif(btrim(p_comment), ''), p_declaration);
end;
$$;

create function public.return_prompt_with_comments(
  p_prompt_id uuid,
  p_comments text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select public.has_role('trainer', 'admin')) then
    raise exception 'Only trainers and admins can return prompts.' using errcode = '42501';
  end if;
  if p_comments is null or length(trim(p_comments)) < 5 then
    raise exception 'Add comments of at least five characters.' using errcode = 'P0001';
  end if;

  update public.prompts
  set status = 'draft',
      test_notes_md = left(trim(p_comments), 4000),
      updated_at = now()
  where id = p_prompt_id and status = 'in_review';

  if not found then
    raise exception 'Prompt is not in review.' using errcode = '22023';
  end if;
end;
$$;

revoke all on function public.submit_prompt_for_review(uuid, text) from public;
revoke all on function public.mark_prompt_tested(uuid, text, integer) from public;
revoke all on function public.retire_prompt(uuid, text) from public;
revoke all on function public.log_prompt_copy(uuid, integer) from public;
revoke all on function public.give_prompt_feedback(uuid, integer, public.prompt_feedback_outcome, text, boolean) from public;
revoke all on function public.return_prompt_with_comments(uuid, text) from public;

grant execute on function public.submit_prompt_for_review(uuid, text) to authenticated, service_role;
grant execute on function public.mark_prompt_tested(uuid, text, integer) to authenticated, service_role;
grant execute on function public.retire_prompt(uuid, text) to authenticated, service_role;
grant execute on function public.log_prompt_copy(uuid, integer) to authenticated, service_role;
grant execute on function public.give_prompt_feedback(uuid, integer, public.prompt_feedback_outcome, text, boolean) to authenticated, service_role;
grant execute on function public.return_prompt_with_comments(uuid, text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- publish_content (pages acknowledgement_label + prompt republish)
-- ---------------------------------------------------------------------------

create or replace function public.publish_content(
  p_type public.content_type,
  p_id uuid,
  p_change_note text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  draft public.content_drafts;
  note text := nullif(btrim(p_change_note), '');
  new_version integer;
  actor uuid := (select auth.uid());
  meta jsonb;
  dept_ids uuid[];
  sub_types text[];
  rub uuid;
  pass_pct integer;
  mod_id uuid;
begin
  perform public.require_trainer_or_admin();

  if note is null or length(note) < 5 then
    raise exception 'Add a change note of at least five characters.'
      using errcode = '22023';
  end if;

  if p_type = 'module' then
    raise exception 'Use update_module_overview for module introductions.'
      using errcode = '22023';
  end if;

  select * into draft
  from public.content_drafts d
  where d.content_type = p_type and d.content_id = p_id;

  if not found then
    raise exception 'There is no draft to publish. Save a draft first.'
      using errcode = '22023';
  end if;

  meta := coalesce(draft.metadata, '{}'::jsonb);

  if p_type = 'page' then
    if not public.is_valid_content_slug(meta ->> 'slug') then
      raise exception 'Choose a valid slug before publishing.'
        using errcode = '22023';
    end if;

    update public.pages p
    set
      title = draft.title,
      body_md = draft.body_md,
      slug = meta ->> 'slug',
      owner_id = nullif(meta ->> 'owner_id', '')::uuid,
      review_by = nullif(meta ->> 'review_by', '')::date,
      requires_acknowledgement = coalesce((meta ->> 'requires_acknowledgement')::boolean, false),
      acknowledgement_label = coalesce(nullif(meta ->> 'acknowledgement_label', ''), 'I have read and will follow these rules'),
      sort_order = coalesce((meta ->> 'sort_order')::integer, 0),
      status = 'published',
      version = case when p.published_at is null then 1 else p.version + 1 end,
      published_at = now(),
      published_by = actor,
      updated_at = now()
    where p.id = p_id
    returning p.version into new_version;

    if not found then
      raise exception 'Page not found.' using errcode = '22023';
    end if;
  elsif p_type = 'update' then
    if not public.is_valid_content_slug(meta ->> 'slug') then
      raise exception 'Choose a valid slug before publishing.'
        using errcode = '22023';
    end if;

    update public.updates u
    set
      title = draft.title,
      body_md = draft.body_md,
      slug = meta ->> 'slug',
      tools = coalesce(
        (select array_agg(value) from jsonb_array_elements_text(coalesce(meta -> 'tools', '[]'::jsonb)) as t(value)),
        '{}'::text[]
      ),
      action_required = coalesce((meta ->> 'action_required')::boolean, false),
      action_text = nullif(meta ->> 'action_text', ''),
      action_due = nullif(meta ->> 'action_due', '')::date,
      status = 'published',
      version = case when u.published_at is null then 1 else u.version + 1 end,
      published_at = now(),
      published_by = actor,
      updated_at = now()
    where u.id = p_id
    returning u.version into new_version;

    if not found then
      raise exception 'Update not found.' using errcode = '22023';
    end if;
  elsif p_type = 'lesson' then
    if not public.is_valid_content_slug(meta ->> 'slug') then
      raise exception 'Choose a valid slug before publishing.'
        using errcode = '22023';
    end if;

    if coalesce((meta ->> 'duration_min')::integer, 0) < 1
       or coalesce((meta ->> 'duration_min')::integer, 0) > 60 then
      raise exception 'Duration must be between 1 and 60 minutes.'
        using errcode = '22023';
    end if;

    select coalesce(array_agg(value::uuid), '{}')
    into dept_ids
    from jsonb_array_elements_text(coalesce(meta -> 'department_ids', '[]'::jsonb)) as t(value)
    where value ~ '^[0-9a-f-]{36}$';

    update public.lessons l
    set
      module_id = (meta ->> 'module_id')::uuid,
      slug = meta ->> 'slug',
      title = draft.title,
      summary = nullif(meta ->> 'summary', ''),
      body_md = draft.body_md,
      kind = coalesce((meta ->> 'kind')::public.lesson_kind, 'lesson'),
      duration_min = (meta ->> 'duration_min')::integer,
      video_url = nullif(meta ->> 'video_url', ''),
      resources = coalesce(meta -> 'resources', '[]'::jsonb),
      department_ids = coalesce(dept_ids, '{}'),
      sort_order = coalesce((meta ->> 'sort_order')::integer, 0),
      status = 'published',
      version = case when l.published_at is null then 1 else l.version + 1 end,
      published_at = now(),
      published_by = actor,
      updated_at = now()
    where l.id = p_id
    returning l.version into new_version;

    if not found then
      raise exception 'Lesson not found.' using errcode = '22023';
    end if;
  elsif p_type = 'assignment' then
    mod_id := nullif(meta ->> 'module_id', '')::uuid;
    rub := nullif(meta ->> 'rubric_id', '')::uuid;
    pass_pct := coalesce((meta ->> 'pass_mark_pct')::integer, -1);

    select coalesce(array_agg(value), '{}')
    into sub_types
    from jsonb_array_elements_text(coalesce(meta -> 'submission_types', '[]'::jsonb)) as t(value)
    where value in ('link', 'file', 'text');

    if mod_id is null then
      raise exception 'Choose a module before publishing.' using errcode = '22023';
    end if;

    if rub is null or not exists (select 1 from public.rubrics r where r.id = rub) then
      raise exception 'Choose a valid rubric before publishing.' using errcode = '22023';
    end if;

    if cardinality(sub_types) < 1 then
      raise exception 'Choose at least one submission type.' using errcode = '22023';
    end if;

    if pass_pct < 0 or pass_pct > 100 then
      raise exception 'Pass mark must be between 0 and 100.' using errcode = '22023';
    end if;

    update public.assignments a
    set
      module_id = mod_id,
      title = draft.title,
      brief_md = draft.body_md,
      rubric_id = rub,
      submission_types = sub_types,
      department_id = nullif(meta ->> 'department_id', '')::uuid,
      pass_mark_pct = pass_pct,
      is_test_out = coalesce((meta ->> 'is_test_out')::boolean, false),
      is_sample = coalesce((meta ->> 'is_sample')::boolean, false),
      status = 'published',
      version = case when a.published_at is null then 1 else a.version + 1 end,
      published_at = now(),
      published_by = actor,
      updated_at = now()
    where a.id = p_id
    returning a.version into new_version;

    if not found then
      raise exception 'Assignment not found.' using errcode = '22023';
    end if;
  elsif p_type = 'prompt' then
    if not public.is_valid_content_slug(meta ->> 'slug') then
      raise exception 'Choose a valid slug before publishing.'
        using errcode = '22023';
    end if;

    update public.prompts pr
    set
      title = draft.title,
      body = draft.body_md,
      slug = meta ->> 'slug',
      department_id = nullif(meta ->> 'department_id', '')::uuid,
      task_type = coalesce(nullif(meta ->> 'task_type', ''), pr.task_type),
      tool = coalesce((meta ->> 'tool')::public.ai_tool, pr.tool),
      module_id = nullif(meta ->> 'module_id', '')::uuid,
      risk_tier = coalesce((meta ->> 'risk_tier')::public.risk_tier, pr.risk_tier),
      usage_notes_md = coalesce(nullif(meta ->> 'usage_notes_md', ''), pr.usage_notes_md),
      example_md = coalesce(nullif(meta ->> 'example_md', ''), pr.example_md),
      owner_id = nullif(meta ->> 'owner_id', '')::uuid,
      version = pr.version + 1,
      status = 'in_review',
      tested_at = null,
      tested_by = null,
      test_notes_md = null,
      tasks_tried_count = null,
      updated_at = now()
    where pr.id = p_id
    returning pr.version into new_version;

    if not found then
      raise exception 'Prompt not found.' using errcode = '22023';
    end if;
  else
    raise exception 'Unsupported content type.' using errcode = '22023';
  end if;

  insert into public.content_revisions (
    content_type, content_id, revision_no, title, body_md, metadata, change_note, published_by
  )
  values (
    p_type, p_id, new_version, draft.title, draft.body_md, meta, note, actor
  );

  delete from public.content_drafts d
  where d.content_type = p_type and d.content_id = p_id;

  return new_version;
end;
$$;


alter table public.prompts enable row level security;
alter table public.prompt_feedback enable row level security;
alter table public.prompt_copies enable row level security;

revoke all on table public.prompts, public.prompt_feedback, public.prompt_copies from anon, authenticated;
grant select, insert, update, delete on table public.prompts to authenticated;
grant select, insert on table public.prompt_feedback to authenticated;
grant select, insert on table public.prompt_copies to authenticated;
grant select, insert, update, delete on table public.prompts, public.prompt_feedback, public.prompt_copies to service_role;

revoke all on public.prompt_feedback_manager_counts, public.prompt_copy_manager_counts from anon, authenticated;
grant select on public.prompt_feedback_manager_counts, public.prompt_copy_manager_counts to authenticated;

-- prompts
create policy "learners read tested prompts"
  on public.prompts for select to authenticated
  using (
    status = 'tested'
    or (select public.has_role('trainer', 'admin'))
    or (
      (select public.has_role('champion'))
      and department_id = (select department_id from public.profiles where id = auth.uid())
      and status in ('draft', 'in_review')
    )
  );

create policy "champions insert department drafts"
  on public.prompts for insert to authenticated
  with check (
    (select public.has_role('trainer', 'admin'))
    or (
      (select public.has_role('champion'))
      and status = 'draft'
      and department_id = (select department_id from public.profiles where id = auth.uid())
      and owner_id = auth.uid()
    )
  );

create policy "staff update prompts"
  on public.prompts for update to authenticated
  using (
    (select public.has_role('trainer', 'admin'))
    or (
      (select public.has_role('champion'))
      and status = 'draft'
      and department_id = (select department_id from public.profiles where id = auth.uid())
      and owner_id = auth.uid()
    )
  )
  with check (
    (select public.has_role('trainer', 'admin'))
    or (
      (select public.has_role('champion'))
      and status = 'draft'
      and department_id = (select department_id from public.profiles where id = auth.uid())
      and owner_id = auth.uid()
    )
  );

create policy "trainers delete prompts"
  on public.prompts for delete to authenticated
  using ((select public.has_role('trainer', 'admin')));

-- feedback
create policy "owners insert own feedback"
  on public.prompt_feedback for insert to authenticated
  with check (user_id = auth.uid());

create policy "trainers read all feedback"
  on public.prompt_feedback for select to authenticated
  using (
    user_id = auth.uid()
    or (select public.has_role('trainer', 'admin'))
  );

-- copies
create policy "owners insert own copies"
  on public.prompt_copies for insert to authenticated
  with check (user_id = auth.uid());

create policy "owners read own copies"
  on public.prompt_copies for select to authenticated
  using (
    user_id = auth.uid()
    or (select public.has_role('trainer', 'admin'))
  );

