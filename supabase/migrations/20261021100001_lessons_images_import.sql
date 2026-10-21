-- Purpose: lesson kinds, module overviews, lesson publish flow, progress version,
--   content-images storage, reorder and module overview functions.
-- Tables touched: lessons, modules, lesson_progress, storage.buckets, storage.objects.
-- Prompt: 06 (lessons, images, video, import).

-- Enums --------------------------------------------------------------------

create type public.lesson_kind as enum ('lesson', 'recording', 'worked_example');

-- content_type value 'module' is added in migration 20261021100000_content_type_module.sql

-- Columns ------------------------------------------------------------------

alter table public.lessons
  add column kind public.lesson_kind not null default 'lesson',
  add column resources jsonb not null default '[]',
  add column published_at timestamptz,
  add column published_by uuid references public.profiles (id) on delete set null;

alter table public.modules
  add column overview_md text not null default '';

alter table public.lesson_progress
  add column lesson_version integer not null default 1 check (lesson_version >= 1);

-- Lesson progress stores the lesson version at completion time ----------------

create or replace function public.set_lesson_progress_version()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select l.version into new.lesson_version
  from public.lessons l
  where l.id = new.lesson_id;
  if not found then
    raise exception 'Lesson not found.' using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger lesson_progress_set_version before insert on public.lesson_progress
  for each row execute function public.set_lesson_progress_version();

revoke execute on function public.set_lesson_progress_version() from public, anon, authenticated;

-- Module overview revision counter stored in content_revisions only ----------

create or replace function public.next_module_revision(p_module_id uuid)
returns integer
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(max(r.revision_no), 0) + 1
  from public.content_revisions r
  where r.content_type = 'module' and r.content_id = p_module_id;
$$;

-- Publish / unpublish / restore (lesson + module) ----------------------------

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

create function public.update_module_overview(
  p_module_id uuid,
  p_body_md text,
  p_change_note text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  note text := nullif(btrim(p_change_note), '');
  rev_no integer;
  actor uuid := (select auth.uid());
  mod_row public.modules;
begin
  perform public.require_trainer_or_admin();

  if note is null or length(note) < 5 then
    raise exception 'Add a change note of at least five characters.'
      using errcode = '22023';
  end if;

  select * into mod_row from public.modules m where m.id = p_module_id;
  if not found then
    raise exception 'Module not found.' using errcode = '22023';
  end if;

  update public.modules m
  set overview_md = coalesce(p_body_md, ''), updated_at = now()
  where m.id = p_module_id;

  rev_no := public.next_module_revision(p_module_id);

  insert into public.content_revisions (
    content_type, content_id, revision_no, title, body_md, metadata, change_note, published_by
  )
  values (
    'module', p_module_id, rev_no, mod_row.title, coalesce(p_body_md, ''), '{}'::jsonb, note, actor
  );

  return rev_no;
end;
$$;

comment on function public.update_module_overview(uuid, text, text) is
  'Trainer or admin: saves module overview_md and records a revision.';

create function public.reorder_lessons(
  p_module_id uuid,
  p_lesson_ids uuid[]
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  i integer;
  lid uuid;
  wanted integer;
  matched integer;
begin
  perform public.require_trainer_or_admin();

  wanted := coalesce(array_length(p_lesson_ids, 1), 0);
  if wanted = 0 then
    raise exception 'Choose at least one lesson.' using errcode = '22023';
  end if;

  select count(*) into matched
  from public.lessons l
  where l.module_id = p_module_id and l.id = any (p_lesson_ids);

  if matched <> wanted then
    raise exception 'Every lesson must belong to this module.' using errcode = '22023';
  end if;

  for i in 1..wanted loop
    lid := p_lesson_ids[i];
    update public.lessons l
    set sort_order = i - 1, updated_at = now()
    where l.id = lid and l.module_id = p_module_id;
  end loop;
end;
$$;

grant execute on function public.update_module_overview(uuid, text, text) to authenticated;
grant execute on function public.reorder_lessons(uuid, uuid[]) to authenticated;
grant execute on function public.next_module_revision(uuid) to authenticated;

-- Storage: private content-images bucket -----------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'content-images',
  'content-images',
  false,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "signed in users read content images" on storage.objects
  for select to authenticated
  using (bucket_id = 'content-images');

create policy "trainers upload content images" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'content-images'
    and (select public.has_role('trainer', 'admin'))
  );

create policy "trainers update content images" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'content-images'
    and (select public.has_role('trainer', 'admin'))
  )
  with check (
    bucket_id = 'content-images'
    and (select public.has_role('trainer', 'admin'))
  );

create policy "trainers delete content images" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'content-images'
    and (select public.has_role('trainer', 'admin'))
  );
