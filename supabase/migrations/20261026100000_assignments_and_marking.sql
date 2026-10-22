-- Purpose: module assignments, submissions, marking, double-marking, feedback release.
-- Tables touched: assignments, submissions, review_assignments, reviews, app_settings,
--   storage.buckets, storage.objects; extends publish_content, apply_test_out_result.
-- Prompt: 09 (assignments and marking, DL-028).

-- Enums --------------------------------------------------------------------

create type public.submission_status as enum (
  'submitted',
  'in_review',
  'returned',
  'resubmit_requested',
  'withdrawn'
);

create type public.review_kind as enum (
  'primary',
  'double_mark',
  'final'
);

comment on type public.submission_status is
  'Assignment hand-in lifecycle from submit through feedback or resubmission.';
comment on type public.review_kind is
  'Who produced a review: trainer primary, champion double-mark, or trainer final.';

alter type public.content_type add value if not exists 'assignment';

-- Tables -------------------------------------------------------------------

create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  code text not null check (code ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  module_id uuid not null references public.modules (id) on delete restrict,
  title text not null,
  brief_md text not null default '',
  rubric_id uuid not null references public.rubrics (id) on delete restrict,
  submission_types text[] not null default '{}',
  department_id uuid references public.departments (id) on delete restrict,
  pass_mark_pct integer not null check (pass_mark_pct >= 0 and pass_mark_pct <= 100),
  is_test_out boolean not null default false,
  version integer not null default 1 check (version >= 1),
  status public.content_status not null default 'draft',
  is_sample boolean not null default false,
  published_at timestamptz,
  published_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (code, version),
  check (submission_types <@ array['link', 'file', 'text']::text[])
);

comment on table public.assignments is
  'Module assignments. Draft body lives in content_drafts until publish.';

create index assignments_module_status_idx on public.assignments (module_id, status);
create index assignments_code_version_idx on public.assignments (code, version);

create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments (id) on delete restrict,
  user_id uuid not null references public.profiles (id) on delete cascade,
  attempt_no integer not null check (attempt_no >= 1),
  link_url text,
  file_path text,
  text_md text,
  data_declaration boolean not null,
  status public.submission_status not null default 'submitted',
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (assignment_id, user_id, attempt_no),
  check (data_declaration),
  check (
    link_url is not null
    or file_path is not null
    or nullif(btrim(text_md), '') is not null
  )
);

comment on table public.submissions is
  'Learner hand-ins. One row per attempt; resubmissions increment attempt_no.';

create index submissions_assignment_id_idx on public.submissions (assignment_id);
create index submissions_user_id_idx on public.submissions (user_id);
create index submissions_status_idx on public.submissions (status);

create table public.review_assignments (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions (id) on delete cascade,
  reviewer_id uuid not null references public.profiles (id) on delete restrict,
  kind public.review_kind not null default 'double_mark',
  assigned_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (submission_id, reviewer_id, kind),
  check (kind = 'double_mark')
);

comment on table public.review_assignments is
  'Champion double-mark queue. Grants scoped read access to one submission.';

create index review_assignments_reviewer_idx on public.review_assignments (reviewer_id);
create index review_assignments_submission_idx on public.review_assignments (submission_id);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions (id) on delete cascade,
  reviewer_id uuid not null references public.profiles (id) on delete restrict,
  kind public.review_kind not null,
  criterion_scores jsonb not null default '{}'::jsonb,
  total numeric not null default 0,
  max_total numeric not null default 0,
  feedback_md text,
  created_at timestamptz not null default now(),
  released_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (submission_id, reviewer_id, kind)
);

comment on table public.reviews is
  'Rubric marks and feedback. Learners see released primary or final only, never double-mark.';

create index reviews_submission_id_idx on public.reviews (submission_id);

-- Triggers -----------------------------------------------------------------

create trigger assignments_set_updated_at before update on public.assignments
  for each row execute function public.set_updated_at();
create trigger submissions_set_updated_at before update on public.submissions
  for each row execute function public.set_updated_at();
create trigger review_assignments_set_updated_at before update on public.review_assignments
  for each row execute function public.set_updated_at();
create trigger reviews_set_updated_at before update on public.reviews
  for each row execute function public.set_updated_at();

create trigger submissions_audit after insert or update or delete on public.submissions
  for each row execute function public.audit_row_change();
create trigger review_assignments_audit after insert or update or delete on public.review_assignments
  for each row execute function public.audit_row_change();
create trigger reviews_audit after insert or update or delete on public.reviews
  for each row execute function public.audit_row_change();

-- App settings (marking.*, DL-028) -------------------------------------------

insert into public.app_settings (key, value, note)
values
  ('marking.double_mark_sample_pct', '20'::jsonb, 'PROPOSED — share of primary-marked submissions sent for double-mark per department'),
  ('marking.difference_threshold_pct', '15'::jsonb, 'PROPOSED — primary vs double difference share of rubric maximum before final mark required'),
  ('marking.target_working_days', '2'::jsonb, 'PROPOSED — queue display target (working days, Malaysia)')
on conflict (key) do nothing;

-- Helpers --------------------------------------------------------------------

create or replace function public._marking_setting_int(p_suffix text)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select (s.value #>> '{}')::integer
      from public.app_settings s
      where s.key = 'marking.' || p_suffix
    ),
    case p_suffix
      when 'double_mark_sample_pct' then 20
      when 'difference_threshold_pct' then 15
      when 'target_working_days' then 2
      else 0
    end
  );
$$;

comment on function public._marking_setting_int(text) is
  'Reads a marking.* app_settings integer (DL-028 defaults).';

create or replace function public._rubric_max_total(p_rubric_id uuid)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(c.max_score)::numeric, 0)
  from public.rubric_criteria c
  where c.rubric_id = p_rubric_id;
$$;

comment on function public._rubric_max_total(uuid) is
  'Sum of rubric criterion maxima for threshold and display.';

create or replace function public._is_allowed_submission_link(p_url text)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  parsed text;
  host text;
begin
  if p_url is null or btrim(p_url) = '' then
    return false;
  end if;

  parsed := btrim(p_url);
  if parsed !~* '^https://' then
    return false;
  end if;

  host := lower(
    split_part(
      split_part(
        regexp_replace(parsed, '^https://', '', 'i'),
        '/',
        1
      ),
      ':',
      1
    )
  );

  return host in ('claude.ai', 'docs.google.com', 'drive.google.com');
end;
$$;

comment on function public._is_allowed_submission_link(text) is
  'Whether a hand-in link uses an approved https host (D6).';

create or replace function public._champion_assigned_submission(p_submission_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.review_assignments ra
    where ra.submission_id = p_submission_id
      and ra.reviewer_id = (select auth.uid())
      and ra.kind = 'double_mark'
  );
$$;

comment on function public._champion_assigned_submission(uuid) is
  'Whether the caller is assigned to double-mark this submission.';

create or replace function public._champion_saved_double_mark(p_submission_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.reviews r
    where r.submission_id = p_submission_id
      and r.reviewer_id = (select auth.uid())
      and r.kind = 'double_mark'
  );
$$;

comment on function public._champion_saved_double_mark(uuid) is
  'Whether the caller has saved their double-mark review on this submission (D10).';

create or replace function public._submission_released_winning_review(p_submission_id uuid)
returns public.reviews
language sql
stable
security definer
set search_path = ''
as $$
  select r.*
  from public.reviews r
  where r.submission_id = p_submission_id
    and r.released_at is not null
    and r.kind in ('final', 'primary')
  order by case when r.kind = 'final' then 0 else 1 end, r.created_at desc
  limit 1;
$$;

comment on function public._submission_released_winning_review(uuid) is
  'Released mark shown to learner: final over primary (D9).';

revoke execute on function public._marking_setting_int(text) from public, anon, authenticated;
revoke execute on function public._rubric_max_total(uuid) from public, anon, authenticated;
revoke execute on function public._is_allowed_submission_link(text) from public, anon, authenticated;
revoke execute on function public._champion_assigned_submission(uuid) from public, anon;
revoke execute on function public._champion_saved_double_mark(uuid) from public, anon;
revoke execute on function public._submission_released_winning_review(uuid) from public, anon;
grant execute on function public._champion_assigned_submission(uuid) to authenticated;
grant execute on function public._champion_saved_double_mark(uuid) to authenticated;
grant execute on function public._submission_released_winning_review(uuid) to authenticated;

-- Publish / unpublish / restore (assignment branch) --------------------------

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

create or replace function public.unpublish_content(
  p_type public.content_type,
  p_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  reason text := nullif(btrim(p_reason), '');
begin
  perform public.require_trainer_or_admin();

  if reason is null or length(reason) < 5 then
    raise exception 'Add a reason of at least five characters.'
      using errcode = '22023';
  end if;

  if p_type = 'page' then
    update public.pages p
    set status = 'archived', updated_at = now()
    where p.id = p_id and p.status <> 'archived';
    if not found then
      raise exception 'Page not found or already archived.' using errcode = '22023';
    end if;
  elsif p_type = 'update' then
    update public.updates u
    set status = 'archived', updated_at = now()
    where u.id = p_id and u.status <> 'archived';
    if not found then
      raise exception 'Update not found or already archived.' using errcode = '22023';
    end if;
  elsif p_type = 'lesson' then
    update public.lessons l
    set status = 'archived', updated_at = now()
    where l.id = p_id and l.status <> 'archived';
    if not found then
      raise exception 'Lesson not found or already archived.' using errcode = '22023';
    end if;
  elsif p_type = 'assignment' then
    update public.assignments a
    set status = 'archived', updated_at = now()
    where a.id = p_id and a.status <> 'archived';
    if not found then
      raise exception 'Assignment not found or already archived.' using errcode = '22023';
    end if;
  else
    raise exception 'Unsupported content type.' using errcode = '22023';
  end if;
end;
$$;

create or replace function public.restore_revision(
  p_type public.content_type,
  p_id uuid,
  p_revision_no integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  rev public.content_revisions;
  actor uuid := (select auth.uid());
begin
  perform public.require_trainer_or_admin();

  select * into rev
  from public.content_revisions r
  where r.content_type = p_type
    and r.content_id = p_id
    and r.revision_no = p_revision_no;

  if not found then
    raise exception 'Revision not found.' using errcode = '22023';
  end if;

  insert into public.content_drafts (content_type, content_id, title, body_md, metadata, updated_by)
  values (p_type, p_id, rev.title, rev.body_md, rev.metadata, actor)
  on conflict (content_type, content_id) do update
  set
    title = excluded.title,
    body_md = excluded.body_md,
    metadata = excluded.metadata,
    updated_by = excluded.updated_by,
    updated_at = now();
end;
$$;

-- Assignment RPCs ------------------------------------------------------------

create or replace function public.upload_submission_file(
  p_assignment_id uuid,
  p_filename text,
  p_mime_type text,
  p_byte_size bigint
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  asg public.assignments;
  safe_name text;
  attempt_no integer;
  latest_status public.submission_status;
  storage_path text;
  allowed_mimes text[] := array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/png',
    'image/jpeg',
    'text/plain',
    'text/markdown'
  ];
begin
  if actor is null then
    raise exception 'Sign in to upload a file.' using errcode = '42501';
  end if;

  select * into asg
  from public.assignments a
  where a.id = p_assignment_id and a.status = 'published';

  if not found then
    raise exception 'Assignment not found or not published.' using errcode = '22023';
  end if;

  if not ('file' = any (asg.submission_types)) then
    raise exception 'This assignment does not accept file submissions.' using errcode = '22023';
  end if;

  if p_byte_size is null or p_byte_size < 1 or p_byte_size > 10485760 then
    raise exception 'File must be between 1 byte and 10 MB.' using errcode = '22023';
  end if;

  if p_mime_type is null or not (p_mime_type = any (allowed_mimes)) then
    raise exception 'File type is not allowed.' using errcode = '22023';
  end if;

  safe_name := regexp_replace(coalesce(p_filename, 'upload'), '[^a-zA-Z0-9._-]+', '-', 'g');
  safe_name := btrim(safe_name, '-');
  if safe_name = '' then
    safe_name := 'upload';
  end if;

  select s.attempt_no, s.status
  into attempt_no, latest_status
  from public.submissions s
  where s.assignment_id = p_assignment_id and s.user_id = actor
  order by s.attempt_no desc
  limit 1;

  if not found then
    attempt_no := 1;
  elsif latest_status = 'resubmit_requested' then
    attempt_no := attempt_no + 1;
  elsif latest_status in ('submitted', 'in_review', 'returned') then
    raise exception 'Submit or withdraw the current attempt before uploading another file.'
      using errcode = '22023';
  end if;

  storage_path := actor::text || '/' || p_assignment_id::text || '/' ||
    attempt_no::text || '-' || to_char(now() at time zone 'UTC', 'YYYYMMDDHH24MISS') || '-' || safe_name;

  return storage_path;
end;
$$;

comment on function public.upload_submission_file(uuid, text, text, bigint) is
  'Learner: validates file metadata and returns the storage path for hand-in (D5).';

create or replace function public.submit_assignment(
  p_assignment_id uuid,
  p_link_url text default null,
  p_file_path text default null,
  p_text_md text default null,
  p_data_declaration boolean default false
)
returns public.submissions
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  asg public.assignments;
  latest public.submissions;
  result public.submissions;
  next_attempt integer;
  path_prefix text;
begin
  if actor is null then
    raise exception 'Sign in to submit.' using errcode = '42501';
  end if;

  if not coalesce(p_data_declaration, false) then
    raise exception 'Confirm the data declaration before submitting.' using errcode = '22023';
  end if;

  select * into asg
  from public.assignments a
  where a.id = p_assignment_id and a.status = 'published';

  if not found then
    raise exception 'Assignment not found or not published.' using errcode = '22023';
  end if;

  if nullif(btrim(p_link_url), '') is not null and not ('link' = any (asg.submission_types)) then
    raise exception 'This assignment does not accept link submissions.' using errcode = '22023';
  end if;

  if nullif(btrim(p_file_path), '') is not null and not ('file' = any (asg.submission_types)) then
    raise exception 'This assignment does not accept file submissions.' using errcode = '22023';
  end if;

  if nullif(btrim(p_text_md), '') is not null and not ('text' = any (asg.submission_types)) then
    raise exception 'This assignment does not accept text submissions.' using errcode = '22023';
  end if;

  if nullif(btrim(p_link_url), '') is not null
     and not public._is_allowed_submission_link(p_link_url) then
    raise exception 'Use a Claude or Google Docs link (https only).' using errcode = '22023';
  end if;

  if not (
    ('link' = any (asg.submission_types) and nullif(btrim(p_link_url), '') is not null)
    or ('file' = any (asg.submission_types) and nullif(btrim(p_file_path), '') is not null)
    or ('text' = any (asg.submission_types) and nullif(btrim(p_text_md), '') is not null)
  ) then
    raise exception 'Provide at least one allowed submission field.' using errcode = '22023';
  end if;

  if nullif(btrim(p_file_path), '') is not null then
    path_prefix := actor::text || '/' || p_assignment_id::text || '/';
    if p_file_path !~ ('^' || path_prefix) then
      raise exception 'File path is not in your upload folder.' using errcode = '22023';
    end if;
  end if;

  select * into latest
  from public.submissions s
  where s.assignment_id = p_assignment_id and s.user_id = actor
  order by s.attempt_no desc
  limit 1;

  if latest.id is not null then
    if latest.status in ('submitted', 'in_review') then
      raise exception 'You already have a submission being marked.' using errcode = '22023';
    end if;

    if latest.status = 'returned' then
      raise exception 'Request resubmission from your trainer before submitting again.'
        using errcode = '22023';
    end if;

    if latest.status = 'withdrawn' then
      update public.submissions s
      set
        link_url = nullif(btrim(p_link_url), ''),
        file_path = nullif(btrim(p_file_path), ''),
        text_md = nullif(btrim(p_text_md), ''),
        data_declaration = true,
        status = 'submitted',
        submitted_at = now(),
        updated_at = now()
      where s.id = latest.id
      returning * into result;

      return result;
    end if;

    if latest.status = 'resubmit_requested' then
      next_attempt := latest.attempt_no + 1;
      insert into public.submissions (
        assignment_id, user_id, attempt_no, link_url, file_path, text_md,
        data_declaration, status, submitted_at
      )
      values (
        p_assignment_id,
        actor,
        next_attempt,
        nullif(btrim(p_link_url), ''),
        nullif(btrim(p_file_path), ''),
        nullif(btrim(p_text_md), ''),
        true,
        'submitted',
        now()
      )
      returning * into result;

      return result;
    end if;
  end if;

  insert into public.submissions (
    assignment_id, user_id, attempt_no, link_url, file_path, text_md,
    data_declaration, status, submitted_at
  )
  values (
    p_assignment_id,
    actor,
    1,
    nullif(btrim(p_link_url), ''),
    nullif(btrim(p_file_path), ''),
    nullif(btrim(p_text_md), ''),
    true,
    'submitted',
    now()
  )
  returning * into result;

  return result;
end;
$$;

comment on function public.submit_assignment(uuid, text, text, text, boolean) is
  'Learner: validates hand-in and creates or reopens a submission (D4, D6).';

create or replace function public.withdraw_submission(p_submission_id uuid)
returns public.submissions
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  sub public.submissions;
  result public.submissions;
begin
  select * into sub from public.submissions s where s.id = p_submission_id;

  if not found then
    raise exception 'Submission not found.' using errcode = '22023';
  end if;

  if sub.user_id <> actor then
    raise exception 'You can only withdraw your own submission.' using errcode = '42501';
  end if;

  if sub.status <> 'submitted' then
    raise exception 'You can only withdraw before marking starts.' using errcode = '22023';
  end if;

  if exists (
    select 1 from public.reviews r
    where r.submission_id = sub.id and r.kind = 'primary'
  ) then
    raise exception 'Marking has already started.' using errcode = '22023';
  end if;

  update public.submissions s
  set status = 'withdrawn', updated_at = now()
  where s.id = sub.id
  returning * into result;

  return result;
end;
$$;

comment on function public.withdraw_submission(uuid) is
  'Learner: withdraw while submitted and no primary review exists (D4).';

create or replace function public.save_review(
  p_submission_id uuid,
  p_kind public.review_kind,
  p_criterion_scores jsonb,
  p_feedback_md text default null
)
returns public.reviews
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  sub public.submissions;
  asg public.assignments;
  crit record;
  score numeric;
  total numeric := 0;
  max_total numeric;
  result public.reviews;
begin
  select * into sub from public.submissions s where s.id = p_submission_id;
  if not found then
    raise exception 'Submission not found.' using errcode = '22023';
  end if;

  select * into asg from public.assignments a where a.id = sub.assignment_id;
  max_total := public._rubric_max_total(asg.rubric_id);

  if p_kind = 'double_mark' then
    if not public._champion_assigned_submission(p_submission_id) then
      raise exception 'You are not assigned to mark this submission.' using errcode = '42501';
    end if;
    if not (select public.has_role('champion')) then
      raise exception 'Only an assigned champion can save a double-mark.' using errcode = '42501';
    end if;
  elsif p_kind in ('primary', 'final') then
    perform public.require_trainer_or_admin();
  else
    raise exception 'Invalid review kind.' using errcode = '22023';
  end if;

  if sub.status not in ('submitted', 'in_review') then
    raise exception 'This submission cannot be marked in its current state.' using errcode = '22023';
  end if;

  for crit in
    select c.id, c.max_score
    from public.rubric_criteria c
    where c.rubric_id = asg.rubric_id
    order by c.sort_order, c.name
  loop
    score := coalesce((p_criterion_scores ->> crit.id::text)::numeric, null);
    if score is null then
      raise exception 'Every rubric criterion needs a score.' using errcode = '22023';
    end if;
    if score < 0 or score > crit.max_score then
      raise exception 'Criterion score is out of range.' using errcode = '22023';
    end if;
    total := total + score;
  end loop;

  insert into public.reviews (
    submission_id,
    reviewer_id,
    kind,
    criterion_scores,
    total,
    max_total,
    feedback_md
  )
  values (
    p_submission_id,
    actor,
    p_kind,
    coalesce(p_criterion_scores, '{}'::jsonb),
    total,
    max_total,
    nullif(btrim(p_feedback_md), '')
  )
  on conflict (submission_id, reviewer_id, kind) do update set
    criterion_scores = excluded.criterion_scores,
    total = excluded.total,
    max_total = excluded.max_total,
    feedback_md = excluded.feedback_md,
    updated_at = now()
  returning * into result;

  if p_kind = 'primary' and sub.status = 'submitted' then
    update public.submissions s
    set status = 'in_review', updated_at = now()
    where s.id = sub.id;
  end if;

  update public.review_assignments ra
  set completed_at = now(), updated_at = now()
  where ra.submission_id = p_submission_id
    and ra.reviewer_id = actor
    and ra.kind = p_kind
    and ra.completed_at is null;

  return result;
end;
$$;

comment on function public.save_review(uuid, public.review_kind, jsonb, text) is
  'Trainer, admin or assigned champion: stores rubric scores (D4, D10).';

create or replace function public.request_resubmission(
  p_submission_id uuid,
  p_feedback_md text
)
returns public.submissions
language plpgsql
security definer
set search_path = ''
as $$
declare
  sub public.submissions;
  result public.submissions;
  fb text := nullif(btrim(p_feedback_md), '');
begin
  perform public.require_trainer_or_admin();

  if fb is null then
    raise exception 'Add feedback for the learner.' using errcode = '22023';
  end if;

  select * into sub from public.submissions s where s.id = p_submission_id;
  if not found then
    raise exception 'Submission not found.' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.reviews r
    where r.submission_id = p_submission_id and r.kind = 'primary'
  ) then
    raise exception 'Save a primary mark before requesting resubmission.' using errcode = '22023';
  end if;

  update public.reviews r
  set
    feedback_md = fb,
    released_at = coalesce(r.released_at, now()),
    updated_at = now()
  where r.submission_id = p_submission_id
    and r.kind = 'primary';

  update public.submissions s
  set status = 'resubmit_requested', updated_at = now()
  where s.id = p_submission_id
  returning * into result;

  return result;
end;
$$;

comment on function public.request_resubmission(uuid, text) is
  'Trainer or admin: releases primary feedback and requests another attempt (D4).';

create or replace function public.assign_double_marks(p_assignment_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  sample_pct integer;
  pool record;
  champion_id uuid;
  sample_size integer;
  assigned_count integer := 0;
  assigned_by_dept jsonb := '[]'::jsonb;
  skipped jsonb := '[]'::jsonb;
  dept_key text;
begin
  perform public.require_trainer_or_admin();

  sample_pct := public._marking_setting_int('double_mark_sample_pct');

  for dept_key in
    select distinct coalesce(pool.department_id::text, '__none__')
    from (
      select distinct on (s.id)
        s.id,
        p.department_id
      from public.submissions s
      join public.profiles p on p.id = s.user_id
      join public.reviews pr on pr.submission_id = s.id and pr.kind = 'primary'
      where s.assignment_id = p_assignment_id
        and s.status in ('submitted', 'in_review')
        and pr.released_at is null
        and not exists (
          select 1 from public.review_assignments ra
          where ra.submission_id = s.id and ra.kind = 'double_mark'
        )
    ) pool
  loop
    select count(*)::integer into sample_size
    from (
      select s.id
      from public.submissions s
      join public.profiles p on p.id = s.user_id
      join public.reviews pr on pr.submission_id = s.id and pr.kind = 'primary'
      where s.assignment_id = p_assignment_id
        and s.status in ('submitted', 'in_review')
        and pr.released_at is null
        and not exists (
          select 1 from public.review_assignments ra
          where ra.submission_id = s.id and ra.kind = 'double_mark'
        )
        and coalesce(p.department_id::text, '__none__') = dept_key
    ) eligible;

    if sample_size < 1 then
      continue;
    end if;

    sample_size := greatest(1, ceil(sample_size * sample_pct / 100.0)::integer);

    select c.id into champion_id
    from public.profiles c
    where c.role = 'champion'
      and c.is_active
      and (
        (dept_key = '__none__' and c.department_id is null)
        or (dept_key <> '__none__' and c.department_id = dept_key::uuid)
      )
    order by random()
    limit 1;

    if champion_id is null then
      skipped := skipped || jsonb_build_object(
        'department_id', case when dept_key = '__none__' then null else dept_key::uuid end,
        'reason', 'no_champion'
      );
      continue;
    end if;

    assigned_count := 0;

    for pool in
      select s.id as submission_id, s.user_id as learner_id
      from public.submissions s
      join public.profiles p on p.id = s.user_id
      join public.reviews pr on pr.submission_id = s.id and pr.kind = 'primary'
      where s.assignment_id = p_assignment_id
        and s.status in ('submitted', 'in_review')
        and pr.released_at is null
        and not exists (
          select 1 from public.review_assignments ra
          where ra.submission_id = s.id and ra.kind = 'double_mark'
        )
        and coalesce(p.department_id::text, '__none__') = dept_key
        and s.user_id <> champion_id
      order by random()
      limit sample_size
    loop
      insert into public.review_assignments (submission_id, reviewer_id, kind)
      values (pool.submission_id, champion_id, 'double_mark')
      on conflict do nothing;

      assigned_count := assigned_count + 1;
    end loop;

    assigned_by_dept := assigned_by_dept || jsonb_build_object(
      'department_id', case when dept_key = '__none__' then null else dept_key::uuid end,
      'champion_id', champion_id,
      'assigned', assigned_count
    );
  end loop;

  return jsonb_build_object(
    'assigned_by_department', assigned_by_dept,
    'skipped_no_champion', skipped
  );
end;
$$;

comment on function public.assign_double_marks(uuid) is
  'Trainer or admin: random double-mark sample per department (D7, D12).';

create or replace function public.release_feedback(p_submission_id uuid)
returns public.submissions
language plpgsql
security definer
set search_path = ''
as $$
declare
  sub public.submissions;
  asg public.assignments;
  result public.submissions;
  primary_rev public.reviews;
  double_rev public.reviews;
  final_rev public.reviews;
  threshold_pct integer;
  diff_share numeric;
  rules jsonb;
  test_out_code text;
  usr public.profiles;
begin
  perform public.require_trainer_or_admin();

  select * into sub from public.submissions s where s.id = p_submission_id;
  if not found then
    raise exception 'Submission not found.' using errcode = '22023';
  end if;

  if sub.status not in ('in_review', 'submitted') then
    raise exception 'Only submissions being marked can be released.' using errcode = '22023';
  end if;

  select * into asg from public.assignments a where a.id = sub.assignment_id;

  select * into primary_rev
  from public.reviews r
  where r.submission_id = p_submission_id and r.kind = 'primary'
  order by r.created_at desc
  limit 1;

  if primary_rev.id is null then
    raise exception 'Save a primary mark before releasing feedback.' using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.review_assignments ra
    where ra.submission_id = p_submission_id
      and ra.kind = 'double_mark'
      and ra.completed_at is null
  ) then
    raise exception 'Complete pending double-marking before release.' using errcode = '22023';
  end if;

  select * into double_rev
  from public.reviews r
  where r.submission_id = p_submission_id and r.kind = 'double_mark'
  order by r.created_at desc
  limit 1;

  if double_rev.id is not null then
    threshold_pct := public._marking_setting_int('difference_threshold_pct');
    if coalesce(primary_rev.max_total, 0) > 0 then
      diff_share := abs(primary_rev.total - double_rev.total) / primary_rev.max_total;
    else
      diff_share := 0;
    end if;

    if diff_share >= (threshold_pct / 100.0) then
      select * into final_rev
      from public.reviews r
      where r.submission_id = p_submission_id and r.kind = 'final'
      limit 1;

      if final_rev.id is null then
        raise exception
          'Primary and double-mark differ by % or more of the maximum. Record a final mark first.',
          threshold_pct
          using errcode = '22023';
      end if;
    end if;
  end if;

  update public.reviews r
  set released_at = coalesce(r.released_at, now()), updated_at = now()
  where r.submission_id = p_submission_id;

  update public.submissions s
  set status = 'returned', updated_at = now()
  where s.id = p_submission_id
  returning * into result;

  if asg.is_test_out then
    select * into usr from public.profiles p where p.id = sub.user_id;

    if usr.stream is not null then
      select s.value into rules
      from public.app_settings s
      where s.key = 'plan.stream_rules';

      if rules is not null then
        select test_out.elem ->> 'code' into test_out_code
        from jsonb_array_elements(
          coalesce(rules -> 'streams' -> usr.stream::text -> 'test_outs', '[]'::jsonb)
        ) as test_out(elem)
        where test_out.elem ->> 'source_code' = asg.code
          and test_out.elem ->> 'via' = 'assignment'
        limit 1;

        if test_out_code is not null then
          perform public.apply_test_out_result(sub.user_id, test_out_code);
        end if;
      end if;
    end if;
  end if;

  return result;
end;
$$;

comment on function public.release_feedback(uuid) is
  'Trainer or admin: release learner feedback with double-mark and final checks (D8–D11).';

-- apply_test_out_result (assignment via) -------------------------------------

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
  via text;
  asm public.assessments;
  asg public.assignments;
  att public.attempts;
  sub public.submissions;
  win public.reviews;
  attempt_count integer;
  mod_code text;
  mod_id uuid;
  mod_week_end integer;
  result_date text;
  pass_reason text;
  fail_reason text;
  pct numeric;
  did_pass boolean;
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

  via := coalesce(test_out ->> 'via', '');

  if via = 'assignment' then
    select * into asg
    from public.assignments a
    where a.code = (test_out ->> 'source_code')
      and a.status = 'published'
    order by a.version desc
    limit 1;

    if not found then
      return;
    end if;

    select * into sub
    from public.submissions s
    where s.user_id = p_user_id
      and s.assignment_id = asg.id
      and s.status = 'returned'
    order by s.attempt_no desc, s.submitted_at desc
    limit 1;

    if not found then
      return;
    end if;

    select * into win from public._submission_released_winning_review(sub.id);
    if win.id is null then
      return;
    end if;

    result_date := to_char(
      coalesce(sub.submitted_at, now()) at time zone 'Asia/Kuala_Lumpur',
      'DD Mon YYYY'
    );
    test_out_week := (test_out ->> 'week')::integer;
    pass_reason := 'Passed Week ' || test_out_week::text || ' test-out on ' || result_date;
    fail_reason := 'Week ' || test_out_week::text || ' test-out not passed on ' || result_date;

    if coalesce(win.max_total, 0) > 0 then
      pct := round((win.total / win.max_total) * 100, 2);
    else
      pct := 0;
    end if;
    did_pass := pct >= coalesce(asg.pass_mark_pct, 0);

    if did_pass then
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
          user_id, module_id, status, reason, due_week, is_override, override_reason, set_by
        )
        values (
          p_user_id, mod_id, 'tested_out', pass_reason, null, false, null, actor
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
        user_id, module_id, status, reason, due_week, is_override, override_reason, set_by
      )
      values (
        p_user_id, mod_id, 'required', fail_reason, mod_week_end, false, null, actor
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

    return;
  end if;

  if via <> 'assessment' then
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
        user_id, module_id, status, reason, due_week, is_override, override_reason, set_by
      )
      values (
        p_user_id, mod_id, 'tested_out', pass_reason, null, false, null, actor
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
      user_id, module_id, status, reason, due_week, is_override, override_reason, set_by
    )
    values (
      p_user_id, mod_id, 'required', fail_reason, mod_week_end, false, null, actor
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
  'Internal: applies quiz or assignment test-out pass or fail to learner_plan (DL-027, DL-028).';

revoke all on function public.apply_test_out_result(uuid, text) from public;
revoke execute on function public.apply_test_out_result(uuid, text) from anon, authenticated;
grant execute on function public.apply_test_out_result(uuid, text) to service_role;

-- Storage: private submissions bucket --------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'submissions',
  'submissions',
  false,
  10485760,
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/png',
    'image/jpeg',
    'text/plain',
    'text/markdown'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "learners upload own submission files" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'submissions'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "owners read own submission files" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'submissions'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "trainers read all submission files" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'submissions'
    and (select public.has_role('trainer', 'admin'))
  );

create policy "champions read assigned submission files" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'submissions'
    and (select public.has_role('champion'))
    and exists (
      select 1
      from public.submissions s
      join public.review_assignments ra on ra.submission_id = s.id
      where s.file_path = storage.objects.name
        and ra.reviewer_id = (select auth.uid())
        and ra.kind = 'double_mark'
    )
  );

-- Row-level security ---------------------------------------------------------

alter table public.assignments enable row level security;
alter table public.submissions enable row level security;
alter table public.review_assignments enable row level security;
alter table public.reviews enable row level security;

revoke all on table
  public.assignments,
  public.submissions,
  public.review_assignments,
  public.reviews
from anon, authenticated;

grant select, insert, update, delete on table
  public.assignments,
  public.submissions,
  public.review_assignments,
  public.reviews
to authenticated;

grant select, insert, update, delete on table
  public.assignments,
  public.submissions,
  public.review_assignments,
  public.reviews
to service_role;

-- Assignments ----------------------------------------------------------------

create policy "staff read published assignments, trainers read all"
  on public.assignments
  for select to authenticated
  using (
    (status = 'published' and (select public.current_app_role()) is not null)
    or (select public.has_role('trainer', 'admin'))
  );

create policy "trainers manage assignments insert"
  on public.assignments
  for insert to authenticated
  with check ((select public.has_role('trainer', 'admin')));

create policy "trainers manage assignments update"
  on public.assignments
  for update to authenticated
  using ((select public.has_role('trainer', 'admin')))
  with check ((select public.has_role('trainer', 'admin')));

create policy "trainers manage assignments delete"
  on public.assignments
  for delete to authenticated
  using ((select public.has_role('trainer', 'admin')));

-- Submissions (managers excluded) --------------------------------------------

create policy "owners and staff read submissions"
  on public.submissions
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or (select public.has_role('trainer', 'admin'))
    or (
      (select public.has_role('champion'))
      and public._champion_assigned_submission(id)
    )
  );

-- Mutations only via security definer RPCs (no direct insert/update for learners).

create policy "trainers manage submissions"
  on public.submissions
  for all to authenticated
  using ((select public.has_role('trainer', 'admin')))
  with check ((select public.has_role('trainer', 'admin')));

-- Review assignments ---------------------------------------------------------

create policy "trainers read review assignments"
  on public.review_assignments
  for select to authenticated
  using ((select public.has_role('trainer', 'admin')));

create policy "champions read own review assignments"
  on public.review_assignments
  for select to authenticated
  using (
    reviewer_id = (select auth.uid())
    and (select public.has_role('champion'))
  );

create policy "trainers manage review assignments"
  on public.review_assignments
  for all to authenticated
  using ((select public.has_role('trainer', 'admin')))
  with check ((select public.has_role('trainer', 'admin')));

-- Reviews --------------------------------------------------------------------

create policy "trainers read all reviews"
  on public.reviews
  for select to authenticated
  using ((select public.has_role('trainer', 'admin')));

create policy "owners read released learner reviews"
  on public.reviews
  for select to authenticated
  using (
    released_at is not null
    and kind <> 'double_mark'
    and exists (
      select 1 from public.submissions s
      where s.id = submission_id and s.user_id = (select auth.uid())
    )
  );

create policy "champions read assigned reviews"
  on public.reviews
  for select to authenticated
  using (
    (select public.has_role('champion'))
    and public._champion_assigned_submission(submission_id)
    and (
      (kind = 'double_mark' and reviewer_id = (select auth.uid()))
      or (
        kind in ('primary', 'final')
        and public._champion_saved_double_mark(submission_id)
      )
    )
  );

create policy "trainers manage reviews"
  on public.reviews
  for all to authenticated
  using ((select public.has_role('trainer', 'admin')))
  with check ((select public.has_role('trainer', 'admin')));

create policy "champions write own double mark reviews"
  on public.reviews
  for insert to authenticated
  with check (
    kind = 'double_mark'
    and reviewer_id = (select auth.uid())
    and (select public.has_role('champion'))
    and public._champion_assigned_submission(submission_id)
  );

create policy "champions update own double mark reviews"
  on public.reviews
  for update to authenticated
  using (
    kind = 'double_mark'
    and reviewer_id = (select auth.uid())
    and (select public.has_role('champion'))
  )
  with check (
    kind = 'double_mark'
    and reviewer_id = (select auth.uid())
    and (select public.has_role('champion'))
  );

-- Grants ---------------------------------------------------------------------

revoke execute on function public.upload_submission_file(uuid, text, text, bigint) from public, anon;
revoke execute on function public.submit_assignment(uuid, text, text, text, boolean) from public, anon;
revoke execute on function public.withdraw_submission(uuid) from public, anon;
revoke execute on function public.save_review(uuid, public.review_kind, jsonb, text) from public, anon;
revoke execute on function public.request_resubmission(uuid, text) from public, anon;
revoke execute on function public.assign_double_marks(uuid) from public, anon;
revoke execute on function public.release_feedback(uuid) from public, anon;

grant execute on function public.upload_submission_file(uuid, text, text, bigint) to authenticated;
grant execute on function public.submit_assignment(uuid, text, text, text, boolean) to authenticated;
grant execute on function public.withdraw_submission(uuid) to authenticated;
grant execute on function public.save_review(uuid, public.review_kind, jsonb, text) to authenticated;
grant execute on function public.request_resubmission(uuid, text) to authenticated;
grant execute on function public.assign_double_marks(uuid) to authenticated;
grant execute on function public.release_feedback(uuid) to authenticated;
