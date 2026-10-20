-- Purpose: shared building blocks used by every later migration.
--   * set_updated_at() keeps updated_at current on every row change.
--   * Fixed value lists (enums) for roles, scopes, streams, pathways and statuses.
-- Tables touched: none.
-- Prompt: 02 (database foundation).

-- Enums --------------------------------------------------------------------

create type public.app_role as enum ('learner', 'champion', 'manager', 'trainer', 'admin');

create type public.progress_scope_type as enum ('self', 'department', 'all');

create type public.stream_type as enum (
  'foundation',
  'practitioner',
  'practitioner_fast_track',
  'champion'
);

create type public.specialist_pathway_type as enum ('business', 'builder', 'technical');

create type public.content_status as enum ('draft', 'published', 'archived');

create type public.plan_status as enum (
  'required',
  'optional',
  'tested_out',
  'bridge',
  'not_applicable'
);

-- Functions ----------------------------------------------------------------

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

comment on function public.set_updated_at() is
  'Trigger: stamps updated_at with the current time on every update.';

-- Nobody calls trigger functions directly.
revoke execute on function public.set_updated_at() from public, anon, authenticated;
