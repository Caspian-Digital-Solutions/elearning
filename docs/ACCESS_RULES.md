# Access rules — who can read and write each table

Plain-English version of the row-level security (RLS) rules in `supabase/migrations/20261020090006_row_level_security.sql` and `supabase/migrations/20261020130001_users_roles_settings.sql`. RLS is a rule inside the database that decides, row by row, who can read or change data. It applies even if a page has a bug. Every table has RLS switched on.

Last updated: Prompt 04, 20 Oct 2026 (functions the app calls, paused accounts, last active admin, reasons).

## Words used below

- **Staff**: a signed-in person with an active profile. Someone whose profile is switched off (inactive, also called paused) has no rights at all, whatever role their profile still shows. They cannot read their own row either.
- **Signed-out visitors** can read and write nothing.
- **Write**: add, change or remove.
- **People they may see** follows the progress scope:
  - Everyone can see themselves.
  - `department` scope sees their own department and its child departments. For example, Performance includes SEO, Paid and Analytics.
  - `all` scope sees everyone.
  - Trainers and admins always see everyone.

## The rules

| Table | Who can read | Who can write |
|---|---|---|
| `departments` | Staff | Trainer, admin |
| `competency_domains` | Staff | Trainer, admin |
| `stages` | Staff | Trainer, admin |
| `modules` | Staff | Trainer, admin |
| `module_domains` | Staff | Trainer, admin |
| `department_domain_requirements` | Staff | Trainer, admin |
| `cohorts` | Staff | Trainer, admin. A cohort that anyone is in cannot be deleted (the database refuses); archive it instead. An archived cohort cannot take new people. Every change goes to the audit log. |
| `app_settings` | Staff | Admin only, through `admin_update_setting` with a reason. Every change goes to the audit log, with who made it and why. |
| `profiles` | Your own row. Managers see people within their scope. Trainers and admins see everyone. | Nobody adds rows through the app; the database creates your row at your first sign-in (see "Sign-in" below). Anyone active can change their own name. Trainers and admins can also change anyone's department, stream, specialist pathway, cohort and active flag (in the app, through `trainer_update_profiles`). Only an admin can change a role or progress scope (in the app, through `admin_set_role`), and only an admin can pause or restore another admin. Nobody can change a login id, email, sign-up date or last-seen time through the app: the app's database login may update only the name, department, role, progress scope, stream, pathway, cohort and active columns. Nobody can remove a profile through the app. Every change goes to the audit log. |
| `lessons` | Published lessons: staff. Draft and archived lessons: trainer, admin. | Trainer, admin |
| `lesson_progress` | Your own rows. Managers see people within their scope. Trainers and admins see everyone. | An active person adds their own row for a published lesson ("mark as complete") and removes it ("un-mark"). Nobody changes or removes another person's rows. |
| `learner_plan` | Your own plan. Managers see people within their scope. Trainers and admins see everyone. | Trainer, admin. The database records who set each row. |
| `pages` | Published pages: staff. Draft and archived pages: trainer, admin. | Trainer, admin |
| `updates` | Published notes (publish date has passed): staff. Unpublished notes: trainer, admin. | Trainer, admin |
| `audit_log` | Admin only | Nobody directly. Only the automatic recorder writes rows, with the reason given for the change when there is one. Nobody can change or remove a row: not admins, and not the server's secret key. |

Champions have learner rights in these tables. Their marking rights arrive with the assignment tables in Prompt 09.

## Backed by a database guard, not only a policy

- **Role and progress scope:** a learner cannot promote themselves. A guard on `profiles` (`protect_profile_privileges`) rejects any change to a role or progress scope unless the person is an admin. The only other exception is a trusted server job with no signed-in user, such as the Supabase SQL editor.
- **Audit log:** a guard rejects every change or removal of an audit row, from any source.
- **Last active admin:** a guard on `profiles` (`protect_last_admin`) refuses any change that would leave no active admin: demoting the last admin, pausing them, or the only admin changing their own role. It applies everywhere, the Supabase SQL editor included, so the platform cannot be locked out by mistake.
- **Paused admins:** only an admin can pause or restore an admin's access. A trainer cannot.

## The secret key

The Supabase secret key skips these rules. It lives only in server code and in `.env.local`, never in the browser or in Git. It is used only for trusted jobs, such as `npm run db:check` counting the seed rows before anyone can sign in.

## Sign-in

Rules from `supabase/migrations/20261020100001_sign_in.sql` and the app code in `src/proxy.ts`, `src/lib/auth/` and the page layouts.

- **CDS Google accounts only.** Sign-in is by Google. Email and password sign-in is switched off.
- **Two locks on the email domain.** The only allowed domain is `caspiands.com`, held in one function, `is_allowed_sign_in_email`. Change it only by a logged decision in `docs/DECISIONS.md`.
  1. The Supabase "Before User Created" hook (`hook_before_user_created`) refuses any other domain before an account is made. Only Supabase Auth can run it.
  2. If the hook is ever switched off, the trigger that creates the profile (`handle_new_user`) refuses any other domain too, so the account is not created.
  The `hd=caspiands.com` hint sent to Google only tidies the Google account picker. It is not a lock.
- **Refused person sees:** "Please sign in with your CDS Google account."
- **First sign-in creates a profile** with the Google name and email, role learner, progress scope self, no department. The creation goes in the audit log.
- **No department yet:** a learner with no department sees only "Your account is almost ready" with a "Sign out" button, until a trainer assigns a department in Trainer › Users. Trainers and admins see the number of these people as a badge on Users.
- **Signed-out visitors** are sent to `/login` from every page except `/login` and `/auth/callback`. The proxy checks this on every request, and the app layout checks again.
- **Paused (inactive) profile:** no access at all. The person sees "Your access is paused. Contact Mahgol or Bharg." with a "Sign out" button on every page, and the database returns nothing to them. The page learns that they are paused from `my_access_status()` (below), which tells a person only about themselves.
- **Page areas:** Trainer area is for trainers and admins; champions may open Marking only. Admin is for admins only. Each area's layout checks the role on the server; hiding a menu item is not the protection.
- **First admin:** made once, by hand, in the Supabase SQL editor (trusted, so the role guard allows it). Every later role change happens in the app by an admin and goes in the audit log.
- **Preview role (`DEV_PREVIEW_ROLE`):** changes only which menus an admin sees on their own laptop (`npm run dev`). It is ignored for anyone who is not an admin, and ignored in every deployed build. It never changes what the database allows.

## Functions the app calls

The three change functions run as the signed-in person (`security invoker`), so the row-level security rules and guards above still apply on top of each function's own checks. Each one records the reason for the audit log in the same database transaction. `my_access_status` and `record_last_seen` run with the database owner's rights so they work for a paused person, and touch only the caller's own row. Signed-out visitors cannot call any of them.

| Function | Who may call it | What it does | Refuses |
|---|---|---|---|
| `trainer_update_profiles(user_ids, department_id, stream, specialist_pathway, cohort_id, is_active, reason, clear_fields)` | Active trainer or admin | Sets department, stream, specialist pathway, cohort and active status for one person or many. An empty value means "leave unchanged"; `clear_fields` empties a field on purpose. Reason is optional. | Role or progress scope (it has no way to change them); an inactive department; an archived cohort; pausing yourself; a trainer pausing or restoring an admin; a reason over 500 characters. All or nothing: if any one person cannot be changed, nobody is changed. |
| `admin_set_role(user_id, new_role, new_scope, reason)` | Active admin | Sets a person's role and progress scope. | A reason under 10 characters; no change; leaving the platform without an active admin, including the only admin demoting themselves. |
| `admin_update_setting(key, new_value, reason)` | Active admin | Replaces a setting's value. The app checks the shape of known settings first (for example, placement bands must cover 0 to 100 with no gaps or overlaps). | A reason under 10 characters; an empty value; a setting that does not exist. |
| `my_access_status()` | Any signed-in person | Says whether *your own* account is active, paused or missing. | Tells nothing about anyone else. |
| `record_last_seen()` | Any active signed-in person | Updates *your own* "last seen" time, at most once an hour. Not recorded in the audit log. | Paused people (nothing happens). |

## Screens and who can use them

- **Trainer › Users** (`/trainer/users`): trainers and admins. Counts, the people table, the edit panel, bulk changes and the Cohorts tab. Role and scope are shown read-only.
- **Admin › Roles** (`/admin/roles`), **Admin › Settings** (`/admin/settings`), **Admin › Audit log** (`/admin/audit`, and its CSV export at `/admin/audit/export`): admins only.
- Each page checks the role on the server, each server action checks the real role again before calling the database (a preview role never counts), and the database checks a third time.

## Assumptions in Prompt 04

- ASSUMPTION: "Set-up pending" means an active learner with no department, which matches who sees the set-up page.
- ASSUMPTION: "First sign-in" is when the profile was created, which happens at the person's first Google sign-in.
- ASSUMPTION: a trainer's reason is optional and up to 500 characters. Role and setting changes need at least 10 characters.
- ASSUMPTION: a cohort nobody is in may be deleted; one with people may only be archived.
- ASSUMPTION: a paused person loses even the right to rename themselves and un-mark lessons.

## Automated proof

`npm run test:rls` signs in as synthetic people ("Test Learner Content", "Test Manager Creative" and so on) inside one database transaction per test, checks these rules, and rolls everything back. 49 cases: the Prompt 03 rules plus, in `tests/rls/users-roles-settings.test.ts`, the functions, paused accounts, the last-admin guard, cohorts, settings and who can read the audit log. It needs `SUPABASE_DB_URL` (the dev database) in `.env.local`.
