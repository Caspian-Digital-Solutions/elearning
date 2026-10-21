-- Purpose: Week 0 placement assessment — rubrics, assessments, attempts, marking,
--   placement results, scoring and confirmation functions.
-- Tables touched: rubrics, rubric_criteria, rubric_levels, assessments,
--   assessment_sections, assessment_items, assessment_item_keys, attempts,
--   responses, response_scores, placement_results; app_settings (seed row).
-- Prompt: 07 (Week 0 assessment, marking, placement).

-- Enums --------------------------------------------------------------------

create type public.assessment_type as enum (
  'placement',
  'quiz',
  'safety_quiz',
  'capstone'
);

create type public.item_type as enum (
  'profile',
  'choice',
  'short_text',
  'practical'
);

create type public.attempt_status as enum (
  'in_progress',
  'submitted',
  'marking',
  'marked',
  'confirmed'
);

create type public.response_format as enum (
  'text',
  'prompt_and_output',
  'link'
);

comment on type public.assessment_type is
  'Kind of assessment. Week 0 uses placement; quizzes and capstone follow in later prompts.';
comment on type public.item_type is
  'Learner-facing item shape. Profile items collect answers but do not score.';
comment on type public.attempt_status is
  'Attempt lifecycle from in progress through trainer confirmation.';
comment on type public.response_format is
  'How short_text and practical answers are captured.';

-- Tables: rubrics (shared with assignments, Prompt 09) -----------------------

create table public.rubrics (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique check (ref ~ '^[A-Z0-9][A-Z0-9_-]*$'),
  title text not null,
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.rubrics is
  'Marking rubrics referenced by assessment items and later assignments.';

create table public.rubric_criteria (
  id uuid primary key default gen_random_uuid(),
  rubric_id uuid not null references public.rubrics (id) on delete cascade,
  name text not null,
  max_score integer not null check (max_score >= 0),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.rubric_levels (
  id uuid primary key default gen_random_uuid(),
  criterion_id uuid not null references public.rubric_criteria (id) on delete cascade,
  score integer not null check (score >= 0),
  descriptor text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (criterion_id, score)
);

comment on table public.rubric_criteria is 'One scored dimension within a rubric.';
comment on table public.rubric_levels is 'Score level descriptors for a criterion.';

-- Tables: assessments ------------------------------------------------------

create table public.assessments (
  id uuid primary key default gen_random_uuid(),
  code text not null check (code ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null,
  type public.assessment_type not null,
  module_id uuid references public.modules (id) on delete restrict,
  instructions_md text not null default '',
  time_guide_min integer check (time_guide_min is null or time_guide_min > 0),
  version integer not null default 1 check (version >= 1),
  status public.content_status not null default 'draft',
  pass_mark integer check (pass_mark is null or (pass_mark >= 0 and pass_mark <= 100)),
  is_sample boolean not null default false,
  published_at timestamptz,
  published_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (code, version),
  check (
    (type = 'placement' and module_id is null)
    or (type <> 'placement' and module_id is not null)
  )
);

comment on table public.assessments is
  'Assessment definitions. Week 0 placement has no module_id; quizzes link to a module.';

create table public.assessment_sections (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessments (id) on delete cascade,
  code text not null check (code ~ '^[a-z0-9_]+$'),
  title text not null,
  max_score integer check (max_score is null or max_score >= 0),
  counts_in_total boolean not null default true,
  sort_order integer not null default 0,
  instructions_md text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (assessment_id, code)
);

comment on table public.assessment_sections is
  'Sections within an assessment (knowledge, prompting, department, and so on).';

create table public.assessment_items (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessments (id) on delete cascade,
  section_id uuid not null references public.assessment_sections (id) on delete cascade,
  ref text not null check (ref ~ '^[A-Z0-9][A-Z0-9_-]*$'),
  type public.item_type not null,
  sort_order integer not null default 0,
  prompt_md text not null default '',
  options jsonb not null default '[]',
  response_format public.response_format,
  department_id uuid references public.departments (id) on delete restrict,
  domain_id uuid references public.competency_domains (id) on delete restrict,
  difficulty smallint check (difficulty is null or difficulty between 1 and 3),
  points integer not null default 0 check (points >= 0),
  rubric_id uuid references public.rubrics (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (assessment_id, ref),
  check (
    (type in ('short_text', 'practical') and response_format is not null)
    or (type not in ('short_text', 'practical') and response_format is null)
  ),
  check (
    (type = 'practical' and rubric_id is not null)
    or (type <> 'practical' or rubric_id is null)
  )
);

comment on table public.assessment_items is
  'Learner-visible questions only. Correct answers and points live in assessment_item_keys.';

create table public.assessment_item_keys (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null unique references public.assessment_items (id) on delete cascade,
  option_points jsonb not null default '{}',
  model_answer_md text,
  explanation_md text,
  marking_notes_md text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.assessment_item_keys is
  'Trainer-only marking data. Learners never receive these columns through the API.';

create table public.attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  assessment_id uuid not null references public.assessments (id) on delete restrict,
  status public.attempt_status not null default 'in_progress',
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  seconds_active integer check (seconds_active is null or seconds_active >= 0),
  data_declaration boolean not null default false,
  allowed_by uuid references public.profiles (id) on delete set null,
  meta jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.attempts is
  'One person sitting one assessment version. Retakes set allowed_by to the trainer who permitted them.';
comment on column public.attempts.meta is
  'Per-attempt data such as shuffled option order for choice items.';

create table public.responses (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.attempts (id) on delete cascade,
  item_id uuid not null references public.assessment_items (id) on delete restrict,
  answer jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (attempt_id, item_id)
);

comment on table public.responses is
  'Learner answers while the attempt is in progress. Locked after submit.';

create table public.response_scores (
  id uuid primary key default gen_random_uuid(),
  response_id uuid not null unique references public.responses (id) on delete cascade,
  auto_score numeric(8, 2) check (auto_score is null or auto_score >= 0),
  marker_score numeric(8, 2) check (marker_score is null or marker_score >= 0),
  criterion_scores jsonb,
  comment_md text,
  marked_by uuid references public.profiles (id) on delete set null,
  marked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.response_scores is
  'Scores written by submit_attempt (auto) or save_mark (human).';

create table public.placement_results (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null unique references public.attempts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  section_scores jsonb not null default '{}',
  total numeric(8, 2) not null default 0,
  domain_percentages jsonb not null default '{}',
  suggested_band text,
  suggested_stream public.stream_type,
  gates_failed text[] not null default '{}',
  bridges text[] not null default '{}',
  required_domain_flags text[] not null default '{}',
  settings_snapshot jsonb not null default '{}',
  confirmed_stream public.stream_type,
  confirmed_by uuid references public.profiles (id) on delete set null,
  confirmed_at timestamptz,
  override_reason text,
  portfolio_reviewed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.placement_results is
  'Computed placement for a Week 0 attempt; trainer confirms stream separately.';

-- Indexes ------------------------------------------------------------------

create index rubric_criteria_rubric_id_idx on public.rubric_criteria (rubric_id);
create index rubric_levels_criterion_id_idx on public.rubric_levels (criterion_id);

create index assessments_module_id_idx on public.assessments (module_id);
create index assessments_code_status_idx on public.assessments (code, status);

create index assessment_sections_assessment_id_idx on public.assessment_sections (assessment_id);

create index assessment_items_assessment_id_idx on public.assessment_items (assessment_id);
create index assessment_items_section_id_idx on public.assessment_items (section_id);
create index assessment_items_department_id_idx on public.assessment_items (department_id);
create index assessment_items_domain_id_idx on public.assessment_items (domain_id);

create index attempts_user_id_idx on public.attempts (user_id);
create index attempts_assessment_id_idx on public.attempts (assessment_id);
create index attempts_status_idx on public.attempts (status);

create unique index attempts_one_primary_per_user_assessment_idx
  on public.attempts (user_id, assessment_id)
  where allowed_by is null;

create index responses_attempt_id_idx on public.responses (attempt_id);
create index responses_item_id_idx on public.responses (item_id);

create index placement_results_user_id_idx on public.placement_results (user_id);

-- Triggers: updated_at -------------------------------------------------------

create trigger rubrics_set_updated_at before update on public.rubrics
  for each row execute function public.set_updated_at();
create trigger rubric_criteria_set_updated_at before update on public.rubric_criteria
  for each row execute function public.set_updated_at();
create trigger rubric_levels_set_updated_at before update on public.rubric_levels
  for each row execute function public.set_updated_at();
create trigger assessments_set_updated_at before update on public.assessments
  for each row execute function public.set_updated_at();
create trigger assessment_sections_set_updated_at before update on public.assessment_sections
  for each row execute function public.set_updated_at();
create trigger assessment_items_set_updated_at before update on public.assessment_items
  for each row execute function public.set_updated_at();
create trigger assessment_item_keys_set_updated_at before update on public.assessment_item_keys
  for each row execute function public.set_updated_at();
create trigger attempts_set_updated_at before update on public.attempts
  for each row execute function public.set_updated_at();
create trigger responses_set_updated_at before update on public.responses
  for each row execute function public.set_updated_at();
create trigger response_scores_set_updated_at before update on public.response_scores
  for each row execute function public.set_updated_at();
create trigger placement_results_set_updated_at before update on public.placement_results
  for each row execute function public.set_updated_at();

-- Triggers: audit -----------------------------------------------------------

create trigger placement_results_audit after insert or update or delete on public.placement_results
  for each row execute function public.audit_row_change();
create trigger response_scores_audit after insert or update or delete on public.response_scores
  for each row execute function public.audit_row_change();

-- Triggers: immutability when attempts exist ---------------------------------

create or replace function public.prevent_assessment_structure_change()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  target_assessment uuid;
begin
  if tg_table_name = 'assessment_sections' then
    target_assessment := coalesce(new.assessment_id, old.assessment_id);
  elsif tg_table_name = 'assessment_items' then
    target_assessment := coalesce(new.assessment_id, old.assessment_id);
  elsif tg_table_name = 'assessment_item_keys' then
    select i.assessment_id into target_assessment
    from public.assessment_items i
    where i.id = coalesce(new.item_id, old.item_id);
  else
    return coalesce(new, old);
  end if;

  if exists (
    select 1 from public.attempts a where a.assessment_id = target_assessment
  ) then
    raise exception
      'This assessment version already has attempts. Create a new version instead.'
      using errcode = '23506';
  end if;

  return coalesce(new, old);
end;
$$;

comment on function public.prevent_assessment_structure_change() is
  'Blocks edits to sections, items or keys once any attempt exists for that assessment.';

revoke execute on function public.prevent_assessment_structure_change() from public, anon, authenticated;

create trigger assessment_sections_prevent_change_when_attempts
  before update or delete on public.assessment_sections
  for each row execute function public.prevent_assessment_structure_change();
create trigger assessment_items_prevent_change_when_attempts
  before update or delete on public.assessment_items
  for each row execute function public.prevent_assessment_structure_change();
create trigger assessment_item_keys_prevent_change_when_attempts
  before update or delete on public.assessment_item_keys
  for each row execute function public.prevent_assessment_structure_change();

-- Helpers --------------------------------------------------------------------

create or replace function public.attempt_item_applies(
  p_item public.assessment_items,
  p_section_code text,
  p_user_department_id uuid,
  p_department_match_id uuid
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case
    when p_item.type = 'profile' then true
    when p_section_code = 'department' then
      p_item.department_id is not null
      and p_item.department_id = p_department_match_id
    else
      p_item.department_id is null
  end;
$$;

comment on function public.attempt_item_applies(public.assessment_items, text, uuid, uuid) is
  'Whether an item is shown to a person (department section uses resolved department match).';

create or replace function public.resolve_department_item_department_id(
  p_assessment_id uuid,
  p_user_department_id uuid
)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  dept_section_id uuid;
  parent_id uuid;
  item_count integer;
begin
  if p_user_department_id is null then
    return null;
  end if;

  select s.id into dept_section_id
  from public.assessment_sections s
  where s.assessment_id = p_assessment_id and s.code = 'department';

  if dept_section_id is null then
    return p_user_department_id;
  end if;

  select count(*) into item_count
  from public.assessment_items i
  where i.section_id = dept_section_id
    and i.department_id = p_user_department_id;

  if item_count > 0 then
    return p_user_department_id;
  end if;

  select d.parent_id into parent_id
  from public.departments d
  where d.id = p_user_department_id;

  if parent_id is not null then
    select count(*) into item_count
    from public.assessment_items i
    where i.section_id = dept_section_id
      and i.department_id = parent_id;

    if item_count > 0 then
      return parent_id;
    end if;
  end if;

  return null;
end;
$$;

comment on function public.resolve_department_item_department_id(uuid, uuid) is
  'Department section item set: own department, else parent (e.g. Performance), else none.';

revoke execute on function public.attempt_item_applies(public.assessment_items, text, uuid, uuid)
  from public, anon, authenticated;
revoke execute on function public.resolve_department_item_department_id(uuid, uuid)
  from public, anon, authenticated;

create or replace function public.response_effective_score(p_response_id uuid)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(rs.marker_score, rs.auto_score, 0)
  from public.response_scores rs
  where rs.response_id = p_response_id;
$$;

revoke execute on function public.response_effective_score(uuid) from public, anon, authenticated;

-- Internal placement calculation (security definer) --------------------------

create or replace function public._calculate_placement_internal(p_attempt_id uuid)
returns public.placement_results
language plpgsql
security definer
set search_path = ''
as $$
declare
  att public.attempts;
  usr public.profiles;
  dept_match uuid;
  sections_cfg jsonb;
  gates_cfg jsonb;
  bands_cfg jsonb;
  bridge_cfg jsonb;
  snapshot jsonb;
  section_rec record;
  item_rec record;
  section_scores jsonb := '{}'::jsonb;
  domain_earned jsonb := '{}'::jsonb;
  domain_available jsonb := '{}'::jsonb;
  domain_pct jsonb := '{}'::jsonb;
  total numeric := 0;
  safety_score numeric := 0;
  prompting_score numeric := 0;
  safety_min numeric;
  prompting_min numeric;
  gates_failed text[] := '{}';
  suggested_band text;
  suggested_stream public.stream_type;
  bridge_threshold numeric := 60;
  bridges text[] := '{}';
  req_flags text[] := '{}';
  band_rec jsonb;
  domain_code text;
  pct numeric;
  item_score numeric;
  section_earned numeric;
  mod_codes text[];
  mod_code text;
  bridge_list text[] := '{}';
  result public.placement_results;
begin
  select * into att from public.attempts a where a.id = p_attempt_id;
  if not found then
    raise exception 'Attempt not found.' using errcode = '22023';
  end if;

  select * into usr from public.profiles p where p.id = att.user_id;
  if not found then
    raise exception 'Profile not found.' using errcode = '22023';
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

  if exists (
    select 1
    from public.assessment_items i
    join public.assessment_sections s on s.id = i.section_id
    where s.assessment_id = att.assessment_id
      and i.type <> 'profile'
      and public.attempt_item_applies(i, s.code, usr.department_id, dept_match)
      and not exists (
        select 1
        from public.responses r
        join public.response_scores rs on rs.response_id = r.id
        where r.attempt_id = att.id
          and r.item_id = i.id
          and (rs.auto_score is not null or rs.marker_score is not null)
      )
  ) then
    raise exception 'Every scorable item must be marked before placement is calculated.'
      using errcode = '22023';
  end if;

  select s.value into sections_cfg
  from public.app_settings s where s.key = 'placement.week0_sections';
  select s.value into gates_cfg from public.app_settings s where s.key = 'placement.gates';
  select s.value into bands_cfg from public.app_settings s where s.key = 'placement.bands';
  select s.value into bridge_cfg from public.app_settings s where s.key = 'placement.bridge_modules';

  snapshot := jsonb_build_object(
    'placement.week0_sections', coalesce(sections_cfg, '{}'::jsonb),
    'placement.gates', coalesce(gates_cfg, '{}'::jsonb),
    'placement.bands', coalesce(bands_cfg, '{}'::jsonb),
    'placement.bridge_modules', coalesce(bridge_cfg, '{}'::jsonb)
  );

  safety_min := coalesce((gates_cfg ->> 'safety_min_else_foundation')::numeric, 9);
  prompting_min := coalesce((gates_cfg ->> 'prompting_min_for_practitioner')::numeric, 15);

  for section_rec in
    select s.id, s.code, s.counts_in_total
    from public.assessment_sections s
    where s.assessment_id = att.assessment_id
    order by s.sort_order, s.code
  loop
    section_earned := 0;

    for item_rec in
      select i.id, i.type, i.points, i.domain_id
      from public.assessment_items i
      where i.section_id = section_rec.id
        and public.attempt_item_applies(
          i, section_rec.code, usr.department_id, dept_match
        )
    loop
      if item_rec.type = 'profile' then
        continue;
      end if;

      select coalesce(public.response_effective_score(r.id), 0) into item_score
      from public.responses r
      where r.attempt_id = att.id and r.item_id = item_rec.id;

      section_earned := section_earned + item_score;

      if item_rec.domain_id is not null then
        select d.code into domain_code
        from public.competency_domains d where d.id = item_rec.domain_id;

        domain_earned := domain_earned || jsonb_build_object(
          domain_code,
          coalesce((domain_earned ->> domain_code)::numeric, 0) + item_score
        );
        domain_available := domain_available || jsonb_build_object(
          domain_code,
          coalesce((domain_available ->> domain_code)::numeric, 0) + item_rec.points
        );
      end if;
    end loop;

    section_scores := section_scores || jsonb_build_object(section_rec.code, section_earned);

    if section_rec.code = 'safety' then
      safety_score := section_earned;
    elsif section_rec.code = 'prompting' then
      prompting_score := section_earned;
    end if;

    if section_rec.counts_in_total then
      total := total + section_earned;
    end if;
  end loop;

  for domain_code in
    select key from jsonb_object_keys(coalesce(domain_available, '{}'::jsonb)) as key
  loop
    if coalesce((domain_available ->> domain_code)::numeric, 0) > 0 then
      pct := round(
        100.0 * coalesce((domain_earned ->> domain_code)::numeric, 0)
          / (domain_available ->> domain_code)::numeric,
        2
      );
      domain_pct := domain_pct || jsonb_build_object(domain_code, pct);
    end if;
  end loop;

  if safety_score < safety_min then
    gates_failed := array_append(gates_failed, 'safety');
  end if;
  if prompting_score < prompting_min then
    gates_failed := array_append(gates_failed, 'prompting');
  end if;

  if array_length(gates_failed, 1) is not null then
    suggested_stream := 'foundation';
    suggested_band := 'foundation';
  else
    suggested_stream := 'foundation';
    suggested_band := null;

    for band_rec in
      select value
      from jsonb_array_elements(coalesce(bands_cfg -> 'bands', '[]'::jsonb)) as value
      order by (value ->> 'min')::numeric
    loop
      if total >= (band_rec ->> 'min')::numeric
         and total <= (band_rec ->> 'max')::numeric then
        suggested_band := band_rec ->> 'stream';
        suggested_stream := (band_rec ->> 'stream')::public.stream_type;
        if band_rec ? 'bridges_for_domains_below_pct' then
          bridge_threshold := (band_rec ->> 'bridges_for_domains_below_pct')::numeric;
        end if;
        exit;
      end if;
    end loop;
  end if;

  if suggested_stream = 'practitioner' then
    for domain_code in
      select key from jsonb_object_keys(domain_pct) as key
    loop
      pct := (domain_pct ->> domain_code)::numeric;
      if pct < bridge_threshold then
        select coalesce(array_agg(t.code order by t.ord), '{}')
        into mod_codes
        from (
          select elem.code, elem.ord
          from jsonb_array_elements_text(
            coalesce(bridge_cfg -> 'modules' -> domain_code, '[]'::jsonb)
          ) with ordinality as elem(code, ord)
        ) t;

        if mod_codes is not null then
          foreach mod_code in array mod_codes loop
            if mod_code is not null and not (mod_code = any (bridge_list)) then
              bridge_list := array_append(bridge_list, mod_code);
            end if;
          end loop;
        end if;
      end if;
    end loop;

    if coalesce(array_length(bridge_list, 1), 0) > 0 then
      select coalesce(array_agg(m.code order by st.sort_order, m.sort_order), '{}')
      into bridges
      from public.modules m
      join public.stages st on st.id = m.stage_id
      where m.code = any (bridge_list);
    end if;
  end if;

  if usr.department_id is not null then
    for domain_code, pct in
      select dom.code, coalesce((domain_pct ->> dom.code)::numeric, 0)
      from public.department_domain_requirements ddr
      join public.competency_domains dom on dom.id = ddr.domain_id
      where ddr.department_id = usr.department_id
        and ddr.required
    loop
      if pct < bridge_threshold then
        req_flags := array_append(req_flags, domain_code);
      end if;
    end loop;
  end if;

  insert into public.placement_results (
    attempt_id,
    user_id,
    section_scores,
    total,
    domain_percentages,
    suggested_band,
    suggested_stream,
    gates_failed,
    bridges,
    required_domain_flags,
    settings_snapshot
  )
  values (
    att.id,
    att.user_id,
    section_scores,
    total,
    domain_pct,
    suggested_band,
    suggested_stream,
    coalesce(gates_failed, '{}'),
    coalesce(bridges, '{}'),
    coalesce(req_flags, '{}'),
    snapshot
  )
  on conflict (attempt_id) do update set
    section_scores = excluded.section_scores,
    total = excluded.total,
    domain_percentages = excluded.domain_percentages,
    suggested_band = excluded.suggested_band,
    suggested_stream = excluded.suggested_stream,
    gates_failed = excluded.gates_failed,
    bridges = excluded.bridges,
    required_domain_flags = excluded.required_domain_flags,
    settings_snapshot = excluded.settings_snapshot,
    updated_at = now()
  where public.placement_results.confirmed_at is null
  returning * into result;

  if result.id is null then
    select * into result from public.placement_results pr where pr.attempt_id = att.id;
    if result.confirmed_at is not null then
      raise exception 'Placement is already confirmed and cannot be recalculated.'
        using errcode = '22023';
    end if;
  end if;

  return result;
end;
$$;

comment on function public._calculate_placement_internal(uuid) is
  'Computes section scores, gates, band, bridges and domain flags for an attempt.';

revoke execute on function public._calculate_placement_internal(uuid) from public, anon, authenticated;

-- API functions --------------------------------------------------------------

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

  select * into existing
  from public.attempts a
  where a.user_id = actor
    and a.assessment_id = p_assessment_id
    and a.status = 'in_progress'
  limit 1;

  if found then
    return existing;
  end if;

  select * into completed
  from public.attempts a
  where a.user_id = actor
    and a.assessment_id = p_assessment_id
    and a.status in ('submitted', 'marking', 'marked', 'confirmed')
  order by a.started_at desc
  limit 1;

  if found then
    if coalesce(completed.meta ->> 'retake_allowed', 'false') <> 'true' then
      raise exception 'You have already completed this assessment. Ask a trainer for a retake.'
        using errcode = '22023';
    end if;
    retake_granted_by := nullif(completed.meta ->> 'retake_allowed_by', '')::uuid;
    completed_attempt_id := completed.id;
  end if;

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

  insert into public.attempts (user_id, assessment_id, allowed_by, meta)
  values (
    actor,
    p_assessment_id,
    retake_granted_by,
    jsonb_build_object('option_order', choice_meta)
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
  'Starts or resumes an in-progress attempt; shuffles choice options once per attempt.';

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

  if asm.type = 'placement' and not coalesce(p_data_declaration, false) then
    raise exception 'Confirm the data declaration before submitting.' using errcode = '22023';
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
  'Submits an attempt, auto-scores choice items from keys, and locks responses.';

create or replace function public.save_mark(
  p_response_id uuid,
  p_criterion_scores jsonb,
  p_comment_md text default null
)
returns public.response_scores
language plpgsql
security invoker
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  resp public.responses;
  att public.attempts;
  item public.assessment_items;
  crit record;
  total numeric := 0;
  score numeric;
  result public.response_scores;
  all_marked boolean;
begin
  perform public.require_trainer_or_admin();

  select * into resp from public.responses r where r.id = p_response_id;
  if not found then
    raise exception 'Response not found.' using errcode = '22023';
  end if;

  select * into att from public.attempts a where a.id = resp.attempt_id;
  select * into item from public.assessment_items i where i.id = resp.item_id;

  if item.type not in ('short_text', 'practical') then
    raise exception 'Only written items are marked manually.' using errcode = '22023';
  end if;

  if item.rubric_id is null then
    raise exception 'This item has no rubric.' using errcode = '22023';
  end if;

  for crit in
    select c.id, c.max_score
    from public.rubric_criteria c
    where c.rubric_id = item.rubric_id
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

  insert into public.response_scores (
    response_id,
    marker_score,
    criterion_scores,
    comment_md,
    marked_by,
    marked_at
  )
  values (
    resp.id,
    total,
    p_criterion_scores,
    nullif(btrim(p_comment_md), ''),
    actor,
    now()
  )
  on conflict (response_id) do update set
    marker_score = excluded.marker_score,
    criterion_scores = excluded.criterion_scores,
    comment_md = excluded.comment_md,
    marked_by = excluded.marked_by,
    marked_at = excluded.marked_at,
    updated_at = now()
  returning * into result;

  select not exists (
    select 1
    from public.assessment_items i
    join public.assessment_sections s on s.id = i.section_id
    join public.profiles p on p.id = att.user_id
    cross join lateral (
      select public.resolve_department_item_department_id(att.assessment_id, p.department_id) as dept_match
    ) dm
    where s.assessment_id = att.assessment_id
      and i.type in ('short_text', 'practical')
      and public.attempt_item_applies(i, s.code, p.department_id, dm.dept_match)
      and not exists (
        select 1
        from public.responses r2
        join public.response_scores rs on rs.response_id = r2.id
        where r2.attempt_id = att.id
          and r2.item_id = i.id
          and rs.marker_score is not null
      )
  ) into all_marked;

  if all_marked and att.status = 'marking' then
    update public.attempts a
    set status = 'marked', updated_at = now()
    where a.id = att.id;
  end if;

  return result;
end;
$$;

comment on function public.save_mark(uuid, jsonb, text) is
  'Trainer or admin: stores rubric criterion scores and comment for one response.';

create or replace function public.calculate_placement(p_attempt_id uuid)
returns public.placement_results
language plpgsql
security invoker
set search_path = ''
as $$
declare
  att public.attempts;
  result public.placement_results;
begin
  perform public.require_trainer_or_admin();

  select * into att from public.attempts a where a.id = p_attempt_id;
  if not found then
    raise exception 'Attempt not found.' using errcode = '22023';
  end if;

  if att.status not in ('marking', 'marked', 'confirmed') then
    raise exception 'Attempt must be submitted before placement is calculated.'
      using errcode = '22023';
  end if;

  result := public._calculate_placement_internal(p_attempt_id);
  return result;
end;
$$;

comment on function public.calculate_placement(uuid) is
  'Trainer or admin: computes or refreshes placement results until confirmation.';

create or replace function public.confirm_placement(
  p_attempt_id uuid,
  p_stream public.stream_type,
  p_reason text default null,
  p_portfolio_reviewed boolean default false
)
returns public.placement_results
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  att public.attempts;
  pr public.placement_results;
  reason text := nullif(btrim(p_reason), '');
begin
  perform public.require_trainer_or_admin();

  select * into att from public.attempts a where a.id = p_attempt_id;
  if not found then
    raise exception 'Attempt not found.' using errcode = '22023';
  end if;

  select * into pr from public.placement_results r where r.attempt_id = p_attempt_id;
  if not found then
    raise exception 'Calculate placement before confirming.' using errcode = '22023';
  end if;

  if pr.confirmed_at is not null then
    raise exception 'Placement is already confirmed.' using errcode = '22023';
  end if;

  if p_stream is distinct from pr.suggested_stream and reason is null then
    raise exception 'Give a reason when overriding the suggested stream.'
      using errcode = '22023';
  end if;

  if p_stream = 'champion' and not coalesce(p_portfolio_reviewed, false) then
    raise exception 'Champion placement requires portfolio review.' using errcode = '22023';
  end if;

  update public.placement_results r
  set
    confirmed_stream = p_stream,
    confirmed_by = actor,
    confirmed_at = now(),
    override_reason = case when p_stream is distinct from r.suggested_stream then reason else null end,
    portfolio_reviewed = coalesce(p_portfolio_reviewed, false),
    updated_at = now()
  where r.attempt_id = p_attempt_id
  returning * into pr;

  update public.profiles p
  set stream = p_stream, updated_at = now()
  where p.id = att.user_id;

  update public.attempts a
  set status = 'confirmed', updated_at = now()
  where a.id = p_attempt_id;

  return pr;
end;
$$;

comment on function public.confirm_placement(uuid, public.stream_type, text, boolean) is
  'Trainer or admin: confirms stream, updates profile, and locks the attempt.';

create or replace function public.allow_retake(
  p_user_id uuid,
  p_assessment_id uuid,
  p_reason text
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  reason text := nullif(btrim(p_reason), '');
  latest public.attempts;
begin
  perform public.require_trainer_or_admin();

  if reason is null then
    raise exception 'Give a reason for allowing a retake.' using errcode = '22023';
  end if;

  select * into latest
  from public.attempts a
  where a.user_id = p_user_id
    and a.assessment_id = p_assessment_id
    and a.status in ('submitted', 'marking', 'marked', 'confirmed')
  order by a.started_at desc
  limit 1;

  if not found then
    raise exception 'No completed attempt found for this person.' using errcode = '22023';
  end if;

  update public.attempts a
  set meta = coalesce(a.meta, '{}'::jsonb) || jsonb_build_object(
    'retake_allowed', true,
    'retake_reason', reason,
    'retake_allowed_by', (select auth.uid()),
    'retake_allowed_at', to_jsonb(now())
  )
  where a.id = latest.id;
end;
$$;

comment on function public.allow_retake(uuid, uuid, text) is
  'Trainer or admin: permits one further attempt for a person on this assessment.';

revoke execute on function public.start_attempt(uuid) from public, anon;
revoke execute on function public.submit_attempt(uuid, boolean) from public, anon;
revoke execute on function public.save_mark(uuid, jsonb, text) from public, anon;
revoke execute on function public.calculate_placement(uuid) from public, anon;
revoke execute on function public.confirm_placement(uuid, public.stream_type, text, boolean) from public, anon;
revoke execute on function public.allow_retake(uuid, uuid, text) from public, anon;

grant execute on function public.start_attempt(uuid) to authenticated;
grant execute on function public.submit_attempt(uuid, boolean) to authenticated;
grant execute on function public.save_mark(uuid, jsonb, text) to authenticated;
grant execute on function public.calculate_placement(uuid) to authenticated;
grant execute on function public.confirm_placement(uuid, public.stream_type, text, boolean) to authenticated;
grant execute on function public.allow_retake(uuid, uuid, text) to authenticated;

-- App settings seed ----------------------------------------------------------

insert into public.app_settings (key, value, note)
values (
  'placement.bridge_modules',
  '{
    "note": "PROPOSED default; replace with Deliverable 4 mapping",
    "modules": {
      "C1": ["F1", "F2"],
      "C2": ["F4", "F5"],
      "C3": ["F3", "F5"],
      "C4": ["F3"],
      "C5": ["F2", "F8"]
    }
  }'::jsonb,
  'PROPOSED default; replace with Deliverable 4 mapping'
)
on conflict (key) do nothing;

-- Row-level security ---------------------------------------------------------

alter table public.rubrics enable row level security;
alter table public.rubric_criteria enable row level security;
alter table public.rubric_levels enable row level security;
alter table public.assessments enable row level security;
alter table public.assessment_sections enable row level security;
alter table public.assessment_items enable row level security;
alter table public.assessment_item_keys enable row level security;
alter table public.attempts enable row level security;
alter table public.responses enable row level security;
alter table public.response_scores enable row level security;
alter table public.placement_results enable row level security;

revoke all on table
  public.rubrics,
  public.rubric_criteria,
  public.rubric_levels,
  public.assessments,
  public.assessment_sections,
  public.assessment_items,
  public.assessment_item_keys,
  public.attempts,
  public.responses,
  public.response_scores,
  public.placement_results
from anon, authenticated;

grant select, insert, update, delete on table
  public.rubrics,
  public.rubric_criteria,
  public.rubric_levels,
  public.assessments,
  public.assessment_sections,
  public.assessment_items,
  public.assessment_item_keys,
  public.attempts,
  public.responses,
  public.response_scores,
  public.placement_results
to authenticated;

grant select, insert, update, delete on table
  public.rubrics,
  public.rubric_criteria,
  public.rubric_levels,
  public.assessments,
  public.assessment_sections,
  public.assessment_items,
  public.assessment_item_keys,
  public.attempts,
  public.responses,
  public.response_scores,
  public.placement_results
to service_role;

-- Rubrics --------------------------------------------------------------------

create policy "staff read rubrics" on public.rubrics
  for select to authenticated
  using ((select public.current_app_role()) is not null);

create policy "trainers and admins manage rubrics" on public.rubrics
  for all to authenticated
  using ((select public.has_role('trainer', 'admin')))
  with check ((select public.has_role('trainer', 'admin')));

create policy "staff read rubric criteria" on public.rubric_criteria
  for select to authenticated
  using ((select public.current_app_role()) is not null);

create policy "trainers and admins manage rubric criteria" on public.rubric_criteria
  for all to authenticated
  using ((select public.has_role('trainer', 'admin')))
  with check ((select public.has_role('trainer', 'admin')));

create policy "staff read rubric levels" on public.rubric_levels
  for select to authenticated
  using ((select public.current_app_role()) is not null);

create policy "trainers and admins manage rubric levels" on public.rubric_levels
  for all to authenticated
  using ((select public.has_role('trainer', 'admin')))
  with check ((select public.has_role('trainer', 'admin')));

-- Assessments, sections, items -----------------------------------------------

create policy "staff read published assessments, trainers and admins read all"
  on public.assessments
  for select to authenticated
  using (
    (status = 'published' and (select public.current_app_role()) is not null)
    or (select public.has_role('trainer', 'admin'))
  );

create policy "trainers and admins manage assessments" on public.assessments
  for insert to authenticated
  with check ((select public.has_role('trainer', 'admin')));

create policy "trainers and admins change assessments" on public.assessments
  for update to authenticated
  using ((select public.has_role('trainer', 'admin')))
  with check ((select public.has_role('trainer', 'admin')));

create policy "trainers and admins remove assessments" on public.assessments
  for delete to authenticated
  using ((select public.has_role('trainer', 'admin')));

create policy "staff read published sections, trainers and admins read all"
  on public.assessment_sections
  for select to authenticated
  using (
    exists (
      select 1 from public.assessments a
      where a.id = assessment_id
        and (
          (a.status = 'published' and (select public.current_app_role()) is not null)
          or (select public.has_role('trainer', 'admin'))
        )
    )
  );

create policy "trainers and admins manage assessment sections" on public.assessment_sections
  for all to authenticated
  using ((select public.has_role('trainer', 'admin')))
  with check ((select public.has_role('trainer', 'admin')));

create policy "staff read published items, trainers and admins read all"
  on public.assessment_items
  for select to authenticated
  using (
    exists (
      select 1 from public.assessments a
      where a.id = assessment_id
        and (
          (a.status = 'published' and (select public.current_app_role()) is not null)
          or (select public.has_role('trainer', 'admin'))
        )
    )
  );

create policy "trainers and admins manage assessment items" on public.assessment_items
  for all to authenticated
  using ((select public.has_role('trainer', 'admin')))
  with check ((select public.has_role('trainer', 'admin')));

create policy "trainers and admins read item keys" on public.assessment_item_keys
  for select to authenticated
  using ((select public.has_role('trainer', 'admin')));

create policy "trainers and admins manage item keys" on public.assessment_item_keys
  for insert to authenticated
  with check ((select public.has_role('trainer', 'admin')));

create policy "trainers and admins change item keys" on public.assessment_item_keys
  for update to authenticated
  using ((select public.has_role('trainer', 'admin')))
  with check ((select public.has_role('trainer', 'admin')));

create policy "trainers and admins remove item keys" on public.assessment_item_keys
  for delete to authenticated
  using ((select public.has_role('trainer', 'admin')));

-- Attempts and responses (managers excluded) -----------------------------------

create policy "owners and trainers read attempts" on public.attempts
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or (select public.has_role('trainer', 'admin'))
  );

create policy "learners start own attempts" on public.attempts
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (select public.current_app_role()) is not null
    and (select public.current_app_role()) not in ('manager')
  );

create policy "owners update in progress attempts" on public.attempts
  for update to authenticated
  using (
    user_id = (select auth.uid())
    and status = 'in_progress'
  )
  with check (
    user_id = (select auth.uid())
    and status = 'in_progress'
  );

create policy "owners and trainers read responses" on public.responses
  for select to authenticated
  using (
    exists (
      select 1 from public.attempts a
      where a.id = attempt_id
        and (
          a.user_id = (select auth.uid())
          or (select public.has_role('trainer', 'admin'))
        )
    )
  );

create policy "owners write responses while in progress" on public.responses
  for insert to authenticated
  with check (
    exists (
      select 1 from public.attempts a
      where a.id = attempt_id
        and a.user_id = (select auth.uid())
        and a.status = 'in_progress'
    )
  );

create policy "owners update responses while in progress" on public.responses
  for update to authenticated
  using (
    exists (
      select 1 from public.attempts a
      where a.id = attempt_id
        and a.user_id = (select auth.uid())
        and a.status = 'in_progress'
    )
  )
  with check (
    exists (
      select 1 from public.attempts a
      where a.id = attempt_id
        and a.user_id = (select auth.uid())
        and a.status = 'in_progress'
    )
  );

-- Response scores ------------------------------------------------------------

create policy "trainers and admins manage response scores" on public.response_scores
  for all to authenticated
  using ((select public.has_role('trainer', 'admin')))
  with check ((select public.has_role('trainer', 'admin')));

create policy "owners read scores after placement confirmed" on public.response_scores
  for select to authenticated
  using (
    exists (
      select 1
      from public.responses r
      join public.attempts a on a.id = r.attempt_id
      join public.placement_results pr on pr.attempt_id = a.id
      where r.id = response_id
        and a.user_id = (select auth.uid())
        and pr.confirmed_at is not null
    )
  );

-- Placement results ----------------------------------------------------------

create policy "trainers and admins read placement results" on public.placement_results
  for select to authenticated
  using ((select public.has_role('trainer', 'admin')));

create policy "trainers and admins write placement results" on public.placement_results
  for insert to authenticated
  with check ((select public.has_role('trainer', 'admin')));

create policy "trainers and admins update placement results" on public.placement_results
  for update to authenticated
  using ((select public.has_role('trainer', 'admin')))
  with check ((select public.has_role('trainer', 'admin')));

create policy "owners read own placement after confirm" on public.placement_results
  for select to authenticated
  using (
    user_id = (select auth.uid())
    and confirmed_at is not null
  );
