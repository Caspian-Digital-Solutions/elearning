-- Purpose: the audit log (ARCHITECTURE 6.8) and the generic trigger that
--   records who changed what. Attached to profiles and app_settings now;
--   placements, marks and certificates attach in later prompts.
-- Tables touched: audit_log (new); triggers on profiles and app_settings.
-- Prompt: 02 (database foundation).

-- Tables -------------------------------------------------------------------

-- actor_id has no foreign key on purpose: an audit row must be written even
-- when the actor has no profile yet, and must survive if a profile is removed.
create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  action text not null check (action in ('insert', 'update', 'delete')),
  table_name text not null,
  row_id uuid,
  before jsonb,
  after jsonb,
  at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.audit_log is
  'Who changed what. Written only by audit_row_change(); never updated or deleted.';
comment on column public.audit_log.actor_id is
  'Signed-in person who made the change. Empty for trusted server jobs (SQL editor, secret-key scripts).';

-- Indexes ------------------------------------------------------------------

create index audit_log_actor_id_idx on public.audit_log (actor_id);
create index audit_log_table_row_idx on public.audit_log (table_name, row_id);
create index audit_log_at_idx on public.audit_log (at desc);

-- Functions ----------------------------------------------------------------

-- Security definer so it can write to audit_log, which no API role can write to.
create function public.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  before_row jsonb;
  after_row jsonb;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    before_row := to_jsonb(old);
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    after_row := to_jsonb(new);
  end if;

  if tg_op = 'UPDATE' and (before_row - 'updated_at') = (after_row - 'updated_at') then
    return new;
  end if;

  insert into public.audit_log (actor_id, action, table_name, row_id, before, after)
  values (
    (select auth.uid()),
    lower(tg_op),
    tg_table_name,
    coalesce((after_row ->> 'id'), (before_row ->> 'id'))::uuid,
    before_row,
    after_row
  );

  return coalesce(new, old);
end;
$$;

comment on function public.audit_row_change() is
  'Trigger: writes one audit_log row per insert, update or delete. Skips updates that change nothing but updated_at.';

create function public.prevent_audit_log_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Audit log rows cannot be changed or removed.'
    using errcode = '42501';
end;
$$;

comment on function public.prevent_audit_log_change() is
  'Trigger: blocks every update and delete on audit_log, including from the secret key.';

revoke execute on function public.audit_row_change() from public, anon, authenticated;
revoke execute on function public.prevent_audit_log_change() from public, anon, authenticated;

-- Triggers -----------------------------------------------------------------

create trigger audit_log_prevent_update_delete before update or delete on public.audit_log
  for each row execute function public.prevent_audit_log_change();

create trigger audit_log_prevent_truncate before truncate on public.audit_log
  for each statement execute function public.prevent_audit_log_change();

create trigger profiles_audit after insert or update or delete on public.profiles
  for each row execute function public.audit_row_change();

create trigger app_settings_audit after insert or update or delete on public.app_settings
  for each row execute function public.audit_row_change();

-- Row-level security (policies in migration 6) ------------------------------

alter table public.audit_log enable row level security;
