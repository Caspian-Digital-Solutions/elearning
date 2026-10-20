# Access rules — who can read and write each table

Plain-English version of the row-level security (RLS) rules in `supabase/migrations/20261020090006_row_level_security.sql`. RLS is a rule inside the database that decides, row by row, who can read or change data. It applies even if a page has a bug. Every table has RLS switched on.

Last updated: Prompt 03, 20 Oct 2026 (sign-in rules added at the end).

## Words used below

- **Staff**: a signed-in person with an active profile. Someone whose profile is switched off (inactive) can read nothing.
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
| `cohorts` | Staff | Trainer, admin |
| `app_settings` | Staff | Admin only. Every change goes to the audit log, with who made it. |
| `profiles` | Your own row. Managers see people within their scope. Trainers and admins see everyone. | Nobody adds rows through the app; the database creates your row at your first sign-in (see "Sign-in" below). Anyone can change their own name. Trainers can also change anyone's department, stream, specialist pathway, cohort and active flag. Only an admin can change a role or progress scope. Nobody can change a login id or email. Nobody can remove a profile through the app. Every change goes to the audit log. |
| `lessons` | Published lessons: staff. Draft and archived lessons: trainer, admin. | Trainer, admin |
| `lesson_progress` | Your own rows. Managers see people within their scope. Trainers and admins see everyone. | You add your own row for a published lesson ("mark as complete") and remove it ("un-mark"). Nobody changes or removes another person's rows. |
| `learner_plan` | Your own plan. Managers see people within their scope. Trainers and admins see everyone. | Trainer, admin. The database records who set each row. |
| `pages` | Published pages: staff. Draft and archived pages: trainer, admin. | Trainer, admin |
| `updates` | Published notes (publish date has passed): staff. Unpublished notes: trainer, admin. | Trainer, admin |
| `audit_log` | Admin only | Nobody directly. Only the automatic recorder writes rows. Nobody can change or remove a row: not admins, and not the server's secret key. |

Champions have learner rights in these tables. Their marking rights arrive with the assignment tables in Prompt 09.

## Backed by a database guard, not only a policy

- **Role and progress scope:** a learner cannot promote themselves. A guard on `profiles` (`protect_profile_privileges`) rejects any change to a role or progress scope unless the person is an admin. The only other exception is a trusted server job with no signed-in user, such as the Supabase SQL editor.
- **Audit log:** a guard rejects every change or removal of an audit row, from any source.

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
- **No department yet:** a learner with no department sees only "Your account is almost ready" with a "Sign out" button, until a trainer assigns a department (Prompt 04).
- **Signed-out visitors** are sent to `/login` from every page except `/login` and `/auth/callback`. The proxy checks this on every request, and the app layout checks again.
- **Inactive profile:** treated as having no access. The person sees "Your account is not active" on the sign-in page and the database returns nothing to them.
- **Page areas:** Trainer area is for trainers and admins; champions may open Marking only. Admin is for admins only. Each area's layout checks the role on the server; hiding a menu item is not the protection.
- **First admin:** made once, by hand, in the Supabase SQL editor (trusted, so the role guard allows it). Every later role change happens in the app by an admin and goes in the audit log.
- **Preview role (`DEV_PREVIEW_ROLE`):** changes only which menus an admin sees on their own laptop (`npm run dev`). It is ignored for anyone who is not an admin, and ignored in every deployed build. It never changes what the database allows.

## Automated proof

`npm run test:rls` signs in as synthetic people ("Test Learner Content", "Test Manager Creative" and so on) inside one database transaction per test, checks these rules, and rolls everything back. It needs `SUPABASE_DB_URL` (the dev database) in `.env.local`.
