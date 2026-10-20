-- Purpose: table access and row-level security policies for every table
--   created in Prompt 02. Plain-English version: docs/ACCESS_RULES.md.
-- Tables touched: departments, competency_domains, stages, modules,
--   module_domains, department_domain_requirements, cohorts, app_settings,
--   profiles, lessons, lesson_progress, learner_plan, pages, updates, audit_log.
-- Prompt: 02 (database foundation).
--
-- "Staff" below means a signed-in person with an active profile
-- (public.current_app_role() is not null). Helper calls are wrapped in
-- (select ...) so Postgres runs them once per query, not once per row.

-- Table access -------------------------------------------------------------
-- Signed-out visitors (anon) get nothing. Signed-in people get only the
-- statement types their policies allow. The secret key (service_role)
-- bypasses RLS for trusted jobs, but can never change the audit log.

revoke all on table
  public.departments,
  public.competency_domains,
  public.stages,
  public.modules,
  public.module_domains,
  public.department_domain_requirements,
  public.cohorts,
  public.app_settings,
  public.profiles,
  public.lessons,
  public.lesson_progress,
  public.learner_plan,
  public.pages,
  public.updates,
  public.audit_log
from anon, authenticated;

grant select, insert, update, delete on table
  public.departments,
  public.competency_domains,
  public.stages,
  public.modules,
  public.module_domains,
  public.department_domain_requirements,
  public.cohorts,
  public.app_settings,
  public.lessons,
  public.learner_plan,
  public.pages,
  public.updates
to authenticated;

grant select, update on table public.profiles to authenticated;
grant select, insert, delete on table public.lesson_progress to authenticated;
grant select on table public.audit_log to authenticated;

grant select, insert, update, delete on table
  public.departments,
  public.competency_domains,
  public.stages,
  public.modules,
  public.module_domains,
  public.department_domain_requirements,
  public.cohorts,
  public.app_settings,
  public.profiles,
  public.lessons,
  public.lesson_progress,
  public.learner_plan,
  public.pages,
  public.updates
to service_role;

revoke all on table public.audit_log from service_role;
grant select on table public.audit_log to service_role;

-- Tables created by later migrations start with no access for anon.
alter default privileges for role postgres in schema public revoke all on tables from anon;
alter default privileges for role postgres in schema public revoke all on sequences from anon;
alter default privileges for role postgres in schema public revoke execute on functions from anon;

-- Reference data: staff read; trainer and admin write ------------------------

create policy "staff read departments" on public.departments
  for select to authenticated
  using ((select public.current_app_role()) is not null);
create policy "trainers and admins add departments" on public.departments
  for insert to authenticated
  with check ((select public.has_role('trainer', 'admin')));
create policy "trainers and admins change departments" on public.departments
  for update to authenticated
  using ((select public.has_role('trainer', 'admin')))
  with check ((select public.has_role('trainer', 'admin')));
create policy "trainers and admins remove departments" on public.departments
  for delete to authenticated
  using ((select public.has_role('trainer', 'admin')));

create policy "staff read competency domains" on public.competency_domains
  for select to authenticated
  using ((select public.current_app_role()) is not null);
create policy "trainers and admins add competency domains" on public.competency_domains
  for insert to authenticated
  with check ((select public.has_role('trainer', 'admin')));
create policy "trainers and admins change competency domains" on public.competency_domains
  for update to authenticated
  using ((select public.has_role('trainer', 'admin')))
  with check ((select public.has_role('trainer', 'admin')));
create policy "trainers and admins remove competency domains" on public.competency_domains
  for delete to authenticated
  using ((select public.has_role('trainer', 'admin')));

create policy "staff read stages" on public.stages
  for select to authenticated
  using ((select public.current_app_role()) is not null);
create policy "trainers and admins add stages" on public.stages
  for insert to authenticated
  with check ((select public.has_role('trainer', 'admin')));
create policy "trainers and admins change stages" on public.stages
  for update to authenticated
  using ((select public.has_role('trainer', 'admin')))
  with check ((select public.has_role('trainer', 'admin')));
create policy "trainers and admins remove stages" on public.stages
  for delete to authenticated
  using ((select public.has_role('trainer', 'admin')));

create policy "staff read modules" on public.modules
  for select to authenticated
  using ((select public.current_app_role()) is not null);
create policy "trainers and admins add modules" on public.modules
  for insert to authenticated
  with check ((select public.has_role('trainer', 'admin')));
create policy "trainers and admins change modules" on public.modules
  for update to authenticated
  using ((select public.has_role('trainer', 'admin')))
  with check ((select public.has_role('trainer', 'admin')));
create policy "trainers and admins remove modules" on public.modules
  for delete to authenticated
  using ((select public.has_role('trainer', 'admin')));

create policy "staff read module domains" on public.module_domains
  for select to authenticated
  using ((select public.current_app_role()) is not null);
create policy "trainers and admins add module domains" on public.module_domains
  for insert to authenticated
  with check ((select public.has_role('trainer', 'admin')));
create policy "trainers and admins change module domains" on public.module_domains
  for update to authenticated
  using ((select public.has_role('trainer', 'admin')))
  with check ((select public.has_role('trainer', 'admin')));
create policy "trainers and admins remove module domains" on public.module_domains
  for delete to authenticated
  using ((select public.has_role('trainer', 'admin')));

create policy "staff read department domain requirements" on public.department_domain_requirements
  for select to authenticated
  using ((select public.current_app_role()) is not null);
create policy "trainers and admins add department domain requirements"
  on public.department_domain_requirements
  for insert to authenticated
  with check ((select public.has_role('trainer', 'admin')));
create policy "trainers and admins change department domain requirements"
  on public.department_domain_requirements
  for update to authenticated
  using ((select public.has_role('trainer', 'admin')))
  with check ((select public.has_role('trainer', 'admin')));
create policy "trainers and admins remove department domain requirements"
  on public.department_domain_requirements
  for delete to authenticated
  using ((select public.has_role('trainer', 'admin')));

create policy "staff read cohorts" on public.cohorts
  for select to authenticated
  using ((select public.current_app_role()) is not null);
create policy "trainers and admins add cohorts" on public.cohorts
  for insert to authenticated
  with check ((select public.has_role('trainer', 'admin')));
create policy "trainers and admins change cohorts" on public.cohorts
  for update to authenticated
  using ((select public.has_role('trainer', 'admin')))
  with check ((select public.has_role('trainer', 'admin')));
create policy "trainers and admins remove cohorts" on public.cohorts
  for delete to authenticated
  using ((select public.has_role('trainer', 'admin')));

-- App settings: staff read; admin writes -----------------------------------

create policy "staff read app settings" on public.app_settings
  for select to authenticated
  using ((select public.current_app_role()) is not null);
create policy "admins add app settings" on public.app_settings
  for insert to authenticated
  with check ((select public.has_role('admin')));
create policy "admins change app settings" on public.app_settings
  for update to authenticated
  using ((select public.has_role('admin')))
  with check ((select public.has_role('admin')));
create policy "admins remove app settings" on public.app_settings
  for delete to authenticated
  using ((select public.has_role('admin')));

-- Profiles -----------------------------------------------------------------
-- No insert policy: profiles are created by a trusted sign-in trigger (Prompt 03).
-- No delete policy: nobody removes a profile through the API.
-- Which columns each role may change is enforced by protect_profile_privileges().

create policy "people read profiles they may see" on public.profiles
  for select to authenticated
  using (public.can_view_user(id));
create policy "people change own profile, trainers and admins change any" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()) or (select public.has_role('trainer', 'admin')))
  with check (id = (select auth.uid()) or (select public.has_role('trainer', 'admin')));

-- Lessons, pages and updates: published for staff; everything for trainer and admin --

create policy "staff read published lessons, trainers and admins read all" on public.lessons
  for select to authenticated
  using (
    (status = 'published' and (select public.current_app_role()) is not null)
    or (select public.has_role('trainer', 'admin'))
  );
create policy "trainers and admins add lessons" on public.lessons
  for insert to authenticated
  with check ((select public.has_role('trainer', 'admin')));
create policy "trainers and admins change lessons" on public.lessons
  for update to authenticated
  using ((select public.has_role('trainer', 'admin')))
  with check ((select public.has_role('trainer', 'admin')));
create policy "trainers and admins remove lessons" on public.lessons
  for delete to authenticated
  using ((select public.has_role('trainer', 'admin')));

create policy "staff read published pages, trainers and admins read all" on public.pages
  for select to authenticated
  using (
    (status = 'published' and (select public.current_app_role()) is not null)
    or (select public.has_role('trainer', 'admin'))
  );
create policy "trainers and admins add pages" on public.pages
  for insert to authenticated
  with check ((select public.has_role('trainer', 'admin')));
create policy "trainers and admins change pages" on public.pages
  for update to authenticated
  using ((select public.has_role('trainer', 'admin')))
  with check ((select public.has_role('trainer', 'admin')));
create policy "trainers and admins remove pages" on public.pages
  for delete to authenticated
  using ((select public.has_role('trainer', 'admin')));

create policy "staff read published updates, trainers and admins read all" on public.updates
  for select to authenticated
  using (
    (published_at is not null and published_at <= now()
      and (select public.current_app_role()) is not null)
    or (select public.has_role('trainer', 'admin'))
  );
create policy "trainers and admins add updates" on public.updates
  for insert to authenticated
  with check ((select public.has_role('trainer', 'admin')));
create policy "trainers and admins change updates" on public.updates
  for update to authenticated
  using ((select public.has_role('trainer', 'admin')))
  with check ((select public.has_role('trainer', 'admin')));
create policy "trainers and admins remove updates" on public.updates
  for delete to authenticated
  using ((select public.has_role('trainer', 'admin')));

-- Lesson progress: owner marks and un-marks; viewers in scope read ----------
-- No update policy: progress rows are added or removed, never edited.

create policy "people read lesson progress they may see" on public.lesson_progress
  for select to authenticated
  using (public.can_view_user(user_id));
create policy "learners mark own published lessons complete" on public.lesson_progress
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (select public.current_app_role()) is not null
    and exists (
      select 1 from public.lessons l
      where l.id = lesson_id and l.status = 'published'
    )
  );
create policy "learners un-mark own lesson progress" on public.lesson_progress
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- Learner plan: owner and viewers in scope read; trainer and admin write ----

create policy "people read learner plans they may see" on public.learner_plan
  for select to authenticated
  using (public.can_view_user(user_id));
create policy "trainers and admins add learner plan rows" on public.learner_plan
  for insert to authenticated
  with check ((select public.has_role('trainer', 'admin')));
create policy "trainers and admins change learner plan rows" on public.learner_plan
  for update to authenticated
  using ((select public.has_role('trainer', 'admin')))
  with check ((select public.has_role('trainer', 'admin')));
create policy "trainers and admins remove learner plan rows" on public.learner_plan
  for delete to authenticated
  using ((select public.has_role('trainer', 'admin')));

-- Audit log: admin reads; only the audit trigger writes ---------------------

create policy "admins read audit log" on public.audit_log
  for select to authenticated
  using ((select public.has_role('admin')));
