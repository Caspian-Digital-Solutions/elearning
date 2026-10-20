-- Purpose: lessons, lesson progress and each person's module plan
--   (ARCHITECTURE 6.3), plus help pages and "What changed" notes (6.6).
-- Tables touched: lessons, lesson_progress, learner_plan, pages, updates.
-- Prompt: 02 (database foundation). Editing screens arrive in Prompts 05, 06 and 08.

-- Tables -------------------------------------------------------------------

-- department_ids is an array (empty = every department), so it cannot have a
-- foreign key; Prompt 06 validates the ids when a trainer saves a lesson.
create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.modules (id) on delete restrict,
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null,
  summary text,
  body_md text not null default '',
  video_url text,
  duration_min integer check (duration_min > 0),
  sort_order integer not null default 0,
  department_ids uuid[] not null default '{}',
  status public.content_status not null default 'draft',
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (module_id, slug)
);

comment on table public.lessons is 'Micro-lessons in Markdown. Only published lessons are visible to learners.';

create table public.lesson_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  completed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, lesson_id)
);

comment on table public.lesson_progress is 'Who finished which lesson. Removing the row un-marks it.';

create table public.learner_plan (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  module_id uuid not null references public.modules (id) on delete restrict,
  status public.plan_status not null,
  reason text,
  set_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, module_id)
);

comment on table public.learner_plan is
  'Each person''s module list. Generated from stream and department rules; a trainer can override with a reason.';

create table public.pages (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null,
  body_md text not null default '',
  version integer not null default 1 check (version >= 1),
  owner_id uuid references public.profiles (id) on delete set null,
  status public.content_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.pages is 'Rules and help pages: data rules, risk tiers, glossary, FAQ, who to ask.';

create table public.updates (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body_md text not null default '',
  tools text[] not null default '{}',
  action_required boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.updates is
  '"What changed" notes. Visible to staff once published_at has passed; empty published_at means draft.';

-- Indexes ------------------------------------------------------------------

create index lesson_progress_lesson_id_idx on public.lesson_progress (lesson_id);
create index learner_plan_module_id_idx on public.learner_plan (module_id);
create index learner_plan_set_by_idx on public.learner_plan (set_by);
create index pages_owner_id_idx on public.pages (owner_id);
create index updates_published_at_idx on public.updates (published_at);

-- Functions ----------------------------------------------------------------

create function public.set_plan_set_by()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.set_by := coalesce((select auth.uid()), new.set_by);
  return new;
end;
$$;

comment on function public.set_plan_set_by() is
  'Trigger: records the signed-in person who set a learner plan row.';

revoke execute on function public.set_plan_set_by() from public, anon, authenticated;

-- Triggers -----------------------------------------------------------------

create trigger lessons_set_updated_at before update on public.lessons
  for each row execute function public.set_updated_at();
create trigger lesson_progress_set_updated_at before update on public.lesson_progress
  for each row execute function public.set_updated_at();
create trigger learner_plan_set_updated_at before update on public.learner_plan
  for each row execute function public.set_updated_at();
create trigger learner_plan_set_set_by before insert or update on public.learner_plan
  for each row execute function public.set_plan_set_by();
create trigger pages_set_updated_at before update on public.pages
  for each row execute function public.set_updated_at();
create trigger updates_set_updated_at before update on public.updates
  for each row execute function public.set_updated_at();

-- Row-level security (policies in migration 6) ------------------------------

alter table public.lessons enable row level security;
alter table public.lesson_progress enable row level security;
alter table public.learner_plan enable row level security;
alter table public.pages enable row level security;
alter table public.updates enable row level security;
