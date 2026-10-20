-- Purpose: help pages, What changed feed, draft/publish workflow and acknowledgements.
-- Tables touched: pages, updates, profiles, content_drafts, content_revisions,
--   page_acknowledgements; functions publish_content, unpublish_content, restore_revision.
-- Prompt: 05 (help pages, What changed, content editor).

-- Enums --------------------------------------------------------------------

create type public.content_type as enum ('page', 'update', 'lesson');

comment on type public.content_type is 'Kind of content in drafts, revisions and publish functions.';

-- Tables -------------------------------------------------------------------

create table public.content_drafts (
  id uuid primary key default gen_random_uuid(),
  content_type public.content_type not null,
  content_id uuid not null,
  title text not null,
  body_md text not null default '',
  metadata jsonb not null default '{}',
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (content_type, content_id)
);

comment on table public.content_drafts is
  'Unpublished title and body. Learners never read this table; published rows stay unchanged until publish.';

create table public.content_revisions (
  id uuid primary key default gen_random_uuid(),
  content_type public.content_type not null,
  content_id uuid not null,
  revision_no integer not null check (revision_no >= 1),
  title text not null,
  body_md text not null default '',
  metadata jsonb not null default '{}',
  change_note text not null,
  published_by uuid references public.profiles (id) on delete set null,
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (content_type, content_id, revision_no)
);

comment on table public.content_revisions is
  'Immutable snapshot each time content is published.';

create table public.page_acknowledgements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  page_id uuid not null references public.pages (id) on delete cascade,
  version integer not null check (version >= 1),
  acknowledged_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, page_id, version)
);

comment on table public.page_acknowledgements is
  'A person confirmed they read a help page version. No updates or deletes through the app.';

-- Extend pages and updates -------------------------------------------------

alter table public.pages
  add column review_by date,
  add column requires_acknowledgement boolean not null default false,
  add column published_at timestamptz,
  add column published_by uuid references public.profiles (id) on delete set null,
  add column sort_order integer not null default 0;

alter table public.updates
  add column slug text,
  add column action_text text,
  add column action_due date,
  add column published_by uuid references public.profiles (id) on delete set null,
  add column status public.content_status not null default 'draft',
  add column version integer not null default 1 check (version >= 1);

alter table public.profiles
  add column updates_seen_at timestamptz;

comment on column public.profiles.updates_seen_at is
  'When the person last opened What changed; used for the unread sidebar badge.';

-- Slug and tools constraints -----------------------------------------------

create or replace function public.is_valid_content_slug(candidate text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select candidate is not null
    and candidate ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    and candidate not in ('new', 'edit', 'admin', 'trainer');
$$;

comment on function public.is_valid_content_slug(text) is
  'Lowercase letters, numbers and hyphens; not a reserved route word.';

alter table public.pages
  drop constraint if exists pages_slug_check,
  add constraint pages_slug_check check (public.is_valid_content_slug(slug));

create unique index updates_slug_key on public.updates (slug) where slug is not null;

alter table public.updates
  add constraint updates_slug_check check (slug is null or public.is_valid_content_slug(slug)),
  add constraint updates_tools_allowed check (
    tools <@ array[
      'Claude', 'ChatGPT', 'Perplexity', 'Jira', 'Confluence', 'Google Workspace', 'Other'
    ]::text[]
  );

-- Backfill updates visibility ------------------------------------------------

update public.updates u
set status = 'published'
where u.published_at is not null
  and u.published_at <= now()
  and u.status = 'draft';

-- Indexes ------------------------------------------------------------------

create index content_drafts_content_idx on public.content_drafts (content_type, content_id);
create index content_drafts_updated_by_idx on public.content_drafts (updated_by);
create index content_revisions_content_idx on public.content_revisions (content_type, content_id);
create index page_acknowledgements_page_id_idx on public.page_acknowledgements (page_id);
create index page_acknowledgements_user_id_idx on public.page_acknowledgements (user_id);
create index pages_search_idx on public.pages
  using gin (to_tsvector('english', coalesce(title, '') || ' ' || coalesce(body_md, '')));

-- Triggers -----------------------------------------------------------------

create trigger content_drafts_set_updated_at before update on public.content_drafts
  for each row execute function public.set_updated_at();

-- Seed adjustments ---------------------------------------------------------

update public.pages set requires_acknowledgement = true where slug = 'data-rules';

update public.pages set sort_order = v.ord
from (values
  ('data-rules', 1),
  ('risk-tiers', 2),
  ('who-to-ask', 3),
  ('faq', 4),
  ('glossary', 5)
) as v (slug, ord)
where pages.slug = v.slug;

insert into public.content_drafts (content_type, content_id, title, body_md, metadata, updated_by)
select
  'page'::public.content_type,
  p.id,
  p.title,
  p.body_md,
  jsonb_build_object(
    'slug', p.slug,
    'owner_id', p.owner_id,
    'review_by', p.review_by,
    'requires_acknowledgement', p.requires_acknowledgement,
    'sort_order', p.sort_order
  ),
  null
from public.pages p
where p.status = 'draft'
  and not exists (
    select 1 from public.content_drafts d
    where d.content_type = 'page' and d.content_id = p.id
  );

-- Functions ----------------------------------------------------------------

create or replace function public.require_trainer_or_admin()
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not public.has_role('trainer', 'admin') then
    raise exception 'Only a trainer or admin can do that.'
      using errcode = '42501';
  end if;
end;
$$;

comment on function public.require_trainer_or_admin() is
  'Shared guard for content publish functions.';

-- Runs as definer so it can write revisions while keeping drafts trainer-only.
create function public.publish_content(
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
begin
  perform public.require_trainer_or_admin();

  if note is null or length(note) < 5 then
    raise exception 'Add a change note of at least five characters.'
      using errcode = '22023';
  end if;

  if p_type = 'lesson' then
    raise exception 'Lesson publishing is not available yet.'
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

comment on function public.publish_content(public.content_type, uuid, text) is
  'Copies the draft to the live row, bumps version, stores a revision and deletes the draft.';

create function public.unpublish_content(
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

  if p_type = 'lesson' then
    raise exception 'Lesson publishing is not available yet.'
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
  else
    raise exception 'Unsupported content type.' using errcode = '22023';
  end if;
end;
$$;

comment on function public.unpublish_content(public.content_type, uuid, text) is
  'Archives published content so learners no longer see it.';

create function public.restore_revision(
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

  if p_type = 'lesson' then
    raise exception 'Lesson publishing is not available yet.'
      using errcode = '22023';
  end if;

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

comment on function public.restore_revision(public.content_type, uuid, integer) is
  'Copies an old revision into the draft table without publishing.';

create function public.mark_updates_seen()
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  update public.profiles p
  set updates_seen_at = now()
  where p.id = (select auth.uid()) and p.is_active;
$$;

comment on function public.mark_updates_seen() is
  'Sets the caller''s updates_seen_at to now when they open What changed.';

revoke execute on function public.require_trainer_or_admin() from public, anon, authenticated;
grant execute on function public.publish_content(public.content_type, uuid, text) to authenticated;
grant execute on function public.unpublish_content(public.content_type, uuid, text) to authenticated;
grant execute on function public.restore_revision(public.content_type, uuid, integer) to authenticated;
grant execute on function public.mark_updates_seen() to authenticated;

create or replace function public.search_help_pages(p_query text)
returns setof public.pages
language sql
stable
security invoker
set search_path = ''
as $$
  select p.*
  from public.pages p
  where p.status = 'published'
    and (
      p_query is null
      or btrim(p_query) = ''
      or to_tsvector('english', coalesce(p.title, '') || ' ' || coalesce(p.body_md, ''))
         @@ plainto_tsquery('english', p_query)
    )
  order by p.sort_order, p.title;
$$;

grant execute on function public.search_help_pages(text) to authenticated;

-- Row-level security ---------------------------------------------------------

alter table public.content_drafts enable row level security;
alter table public.content_revisions enable row level security;
alter table public.page_acknowledgements enable row level security;

create policy "trainers and admins read drafts" on public.content_drafts
  for select to authenticated
  using ((select public.has_role('trainer', 'admin')));

create policy "trainers and admins add drafts" on public.content_drafts
  for insert to authenticated
  with check ((select public.has_role('trainer', 'admin')));

create policy "trainers and admins change drafts" on public.content_drafts
  for update to authenticated
  using ((select public.has_role('trainer', 'admin')))
  with check ((select public.has_role('trainer', 'admin')));

create policy "trainers and admins remove drafts" on public.content_drafts
  for delete to authenticated
  using ((select public.has_role('trainer', 'admin')));

create policy "trainers and admins read revisions" on public.content_revisions
  for select to authenticated
  using ((select public.has_role('trainer', 'admin')));

create policy "people read acknowledgements they may see" on public.page_acknowledgements
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or (select public.has_role('trainer', 'admin'))
    or public.can_view_user(user_id)
  );

create policy "people confirm pages for themselves" on public.page_acknowledgements
  for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "staff read published updates, trainers and admins read all" on public.updates;

create policy "staff read published updates, trainers and admins read all" on public.updates
  for select to authenticated
  using (
    (
      status = 'published'
      and published_at is not null
      and published_at <= now()
      and (select public.current_app_role()) is not null
    )
    or (select public.has_role('trainer', 'admin'))
  );
