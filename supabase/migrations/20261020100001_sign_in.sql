-- Purpose: CDS-only sign-in. Two locks on the email domain:
--   1. hook_before_user_created(): Supabase Auth "Before User Created" hook,
--      which refuses the sign-up with a plain-English message.
--   2. handle_new_user(): trigger on auth.users that refuses any other domain
--      and creates the profile (role learner, scope self, no department).
-- Tables touched: auth.users (trigger), profiles (rows created by the trigger).
-- Prompt: 03 (Google sign-in, roles, access tests).

-- Functions ----------------------------------------------------------------

-- The allowed domain list lives here only; both locks call this function.
create function public.is_allowed_sign_in_email(email text)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  -- Change only by logged decision (docs/DECISIONS.md).
  allowed_domains constant text[] := array['caspiands.com'];
begin
  if email is null or position('@' in email) = 0 then
    return false;
  end if;
  return lower(split_part(email, '@', 2)) = any (allowed_domains)
    and split_part(email, '@', 3) = '';
end;
$$;

comment on function public.is_allowed_sign_in_email(text) is
  'True when the email belongs to a domain allowed to sign in (caspiands.com).';

create function public.hook_before_user_created(event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_allowed_sign_in_email(event -> 'user' ->> 'email') then
    return jsonb_build_object(
      'error', jsonb_build_object(
        'http_code', 403,
        'message', 'Please sign in with your CDS Google account.'
      )
    );
  end if;
  return '{}'::jsonb;
end;
$$;

comment on function public.hook_before_user_created(jsonb) is
  'Supabase Auth hook (Before User Created): refuses sign-ups from any domain other than caspiands.com.';

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_allowed_sign_in_email(new.email) then
    raise exception 'Please sign in with your CDS Google account.'
      using errcode = '42501';
  end if;

  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    lower(new.email),
    nullif(trim(coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name'
    )), '')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

comment on function public.handle_new_user() is
  'Trigger on auth.users: blocks other email domains and creates the profile as learner, scope self, no department.';

-- Function access: only Supabase Auth may call the hook; nobody calls the others directly.

revoke execute on function public.hook_before_user_created(jsonb) from public, anon, authenticated, service_role;
grant execute on function public.hook_before_user_created(jsonb) to supabase_auth_admin;

revoke execute on function public.is_allowed_sign_in_email(text) from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated, service_role;

-- Triggers -----------------------------------------------------------------

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();
