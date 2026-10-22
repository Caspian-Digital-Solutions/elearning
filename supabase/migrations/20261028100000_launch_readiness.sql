-- Prompt 11a: rate limits, leavers, privacy page seed, advisor fixes (search_path).

-- ---------------------------------------------------------------------------
-- Rate limiting (server actions + auth callback)
-- ---------------------------------------------------------------------------

create table if not exists public.rate_limit_events (
  id uuid primary key default gen_random_uuid(),
  bucket_key text not null,
  action_key text not null,
  created_at timestamptz not null default now()
);

create index if not exists rate_limit_events_lookup_idx
  on public.rate_limit_events (bucket_key, action_key, created_at desc);

alter table public.rate_limit_events enable row level security;

comment on table public.rate_limit_events is
  'Short-lived counters for per-user and per-IP rate limits. Rows are inserted only through check_rate_limit.';

create or replace function public.check_rate_limit(
  p_action_key text,
  p_bucket_key text,
  p_window_seconds integer,
  p_max_events integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if p_window_seconds < 1 or p_max_events < 1 then
    return true;
  end if;

  delete from public.rate_limit_events
  where created_at < now() - make_interval(secs => p_window_seconds);

  select count(*)::integer into v_count
  from public.rate_limit_events
  where bucket_key = p_bucket_key
    and action_key = p_action_key
    and created_at > now() - make_interval(secs => p_window_seconds);

  if v_count >= p_max_events then
    return false;
  end if;

  insert into public.rate_limit_events (bucket_key, action_key)
  values (p_bucket_key, p_action_key);

  return true;
end;
$$;

revoke all on function public.check_rate_limit(text, text, integer, integer) from public;
grant execute on function public.check_rate_limit(text, text, integer, integer) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Leavers and retention
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column if not exists left_at date;

comment on column public.profiles.left_at is
  'Date the person left CDS; used for retention (employed + 12 months after leaving).';

create or replace function public.admin_mark_leaver(
  p_user_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public
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

create or replace function public.admin_log_event(
  p_table_name text,
  p_row_id uuid,
  p_reason text,
  p_event text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (select public.has_role('admin')) then
    raise exception 'Only an admin can record this event.' using errcode = '42501';
  end if;
  insert into public.audit_log (actor_id, action, table_name, row_id, after, reason)
  values (
    auth.uid(),
    'update',
    p_table_name,
    p_row_id,
    jsonb_build_object('event', p_event),
    left(trim(p_reason), 500)
  );
end;
$$;

revoke all on function public.admin_log_event(text, uuid, text, text) from public;
grant execute on function public.admin_log_event(text, uuid, text, text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Privacy notice help page (draft)
-- ---------------------------------------------------------------------------

insert into public.pages (slug, title, body_md, status, requires_acknowledgement)
values (
  'privacy',
  'Privacy notice',
  E'# Privacy notice\n\n**Draft — awaiting governance owner (D2)**\n\nThis platform holds staff **personal data** for training and certification.\n\n## What we hold\n\n- Name and work email (from Google sign-in)\n- Department, role, cohort and stream\n- Learning progress, quiz answers, assignment submissions and marks\n- Sign-in and last-seen times\n\n## Why\n\nTo run the CDS AI Academy programme, certify completion, and meet governance obligations.\n\n## Who can see what\n\nAccess follows your role and progress scope. See the access rules in the admin security pack. Managers see **counts**, not individual test scores. Trainers and admins see marks for marking and quality assurance.\n\n## Where data is stored\n\nSupabase (database and files) and Vercel (application hosting), **Singapore region**.\n\n## How long we keep it\n\n**While employed plus 12 months after leaving** (proposed; governance owner to confirm).\n\n## Questions\n\nContact the governance owner (D2) or Bharg for CDS AI Academy.',
  'published',
  true
)
on conflict (slug) do update
set
  title = excluded.title,
  body_md = excluded.body_md,
  status = excluded.status,
  requires_acknowledgement = excluded.requires_acknowledgement,
  updated_at = now();

-- Existing users see the privacy banner until they acknowledge the published page version.
