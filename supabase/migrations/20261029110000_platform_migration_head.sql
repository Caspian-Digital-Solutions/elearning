-- Lets the server (service role) report the latest applied migration on /admin/system.
create or replace function public.platform_migration_head()
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v text;
begin
  select version into v
  from supabase_migrations.schema_migrations
  order by version desc
  limit 1;
  return coalesce(v, 'unknown');
exception
  when undefined_table then
    return 'unknown';
end;
$$;

revoke all on function public.platform_migration_head() from public;
grant execute on function public.platform_migration_head() to service_role;
