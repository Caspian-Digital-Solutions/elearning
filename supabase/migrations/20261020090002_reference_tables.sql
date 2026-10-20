-- Purpose: reference data seeded from docs/seed/curriculum_v1_1.json
--   (ARCHITECTURE 6.1) plus cohorts and editable app settings.
-- Tables touched: departments, competency_domains, stages, modules,
--   module_domains, department_domain_requirements, cohorts, app_settings.
-- Prompt: 02 (database foundation).
-- RLS is switched on here so no table is ever open. The read and write
-- rules are added in 20261020090006_row_level_security.sql; until then
-- nobody can reach these tables through the API.

-- Tables -------------------------------------------------------------------

create table public.departments (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null,
  parent_id uuid references public.departments (id) on delete restrict,
  is_active boolean not null default true,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (parent_id is distinct from id)
);

comment on table public.departments is
  'CDS departments. Child departments (e.g. Performance: SEO) point at their parent.';

create table public.competency_domains (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^C[1-9]$'),
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.competency_domains is 'Competency domains C1 to C9.';

create table public.stages (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z0-9]+(_[a-z0-9]+)*$'),
  name text not null,
  week_start integer not null check (week_start >= 0),
  week_end integer not null,
  hours_per_week numeric(4, 2) check (hours_per_week >= 0),
  sort_order integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (week_end >= week_start)
);

comment on table public.stages is 'Programme stages: assessment, foundation, practitioner and so on.';

create table public.modules (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^(F[1-9]|P([1-9]|10)|L[1-3]|S[1-8])$'),
  title text not null,
  stage_id uuid not null references public.stages (id) on delete restrict,
  week_start integer not null check (week_start >= 0),
  week_end integer not null,
  live_hours numeric(4, 2) not null default 0 check (live_hours >= 0),
  async_hours numeric(4, 2) not null default 0 check (async_hours >= 0),
  assessed_by text,
  is_leadership boolean not null default false,
  sort_order integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (week_end >= week_start)
);

comment on table public.modules is 'Modules F1-F9, P1-P10, L1-L3, S1-S8. Codes, weeks and hours come from the curriculum.';

create table public.module_domains (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.modules (id) on delete cascade,
  domain_id uuid not null references public.competency_domains (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (module_id, domain_id)
);

comment on table public.module_domains is 'Which competency domains each module covers.';

create table public.department_domain_requirements (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments (id) on delete cascade,
  domain_id uuid not null references public.competency_domains (id) on delete restrict,
  required boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (department_id, domain_id)
);

comment on table public.department_domain_requirements is
  'Which domains each department needs at Practitioner level.';

create table public.cohorts (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  start_date date,
  slot text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.cohorts is 'Training cohorts: name, start date and weekly slot.';

-- updated_by gets its foreign key to profiles in the people migration.
create table public.app_settings (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (key ~ '^[a-z0-9_]+(\.[a-z0-9_]+)*$'),
  value jsonb not null,
  note text,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.app_settings is
  'Rules still under approval (placement thresholds, certification rules). Edited by admins, never hard-coded.';

-- Indexes (every foreign key; leading columns of unique keys are already indexed) --

create index departments_parent_id_idx on public.departments (parent_id);
create index modules_stage_id_idx on public.modules (stage_id);
create index module_domains_domain_id_idx on public.module_domains (domain_id);
create index department_domain_requirements_domain_id_idx
  on public.department_domain_requirements (domain_id);
create index app_settings_updated_by_idx on public.app_settings (updated_by);

-- Triggers -----------------------------------------------------------------

create trigger departments_set_updated_at before update on public.departments
  for each row execute function public.set_updated_at();
create trigger competency_domains_set_updated_at before update on public.competency_domains
  for each row execute function public.set_updated_at();
create trigger stages_set_updated_at before update on public.stages
  for each row execute function public.set_updated_at();
create trigger modules_set_updated_at before update on public.modules
  for each row execute function public.set_updated_at();
create trigger module_domains_set_updated_at before update on public.module_domains
  for each row execute function public.set_updated_at();
create trigger department_domain_requirements_set_updated_at
  before update on public.department_domain_requirements
  for each row execute function public.set_updated_at();
create trigger cohorts_set_updated_at before update on public.cohorts
  for each row execute function public.set_updated_at();
create trigger app_settings_set_updated_at before update on public.app_settings
  for each row execute function public.set_updated_at();

-- Row-level security (policies in migration 6) ------------------------------

alter table public.departments enable row level security;
alter table public.competency_domains enable row level security;
alter table public.stages enable row level security;
alter table public.modules enable row level security;
alter table public.module_domains enable row level security;
alter table public.department_domain_requirements enable row level security;
alter table public.cohorts enable row level security;
alter table public.app_settings enable row level security;
