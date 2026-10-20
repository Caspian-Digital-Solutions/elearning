# Access rules — who can read and write each table

Plain-English version of the row-level security (RLS) rules in `supabase/migrations/20261020090006_row_level_security.sql`. RLS is a rule inside the database that decides, row by row, who can read or change data. It applies even if a page has a bug. Every table has RLS switched on.

Last updated: Prompt 02, 20 Oct 2026. Prompt 03 adds the sign-in rules.

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
| `profiles` | Your own row. Managers see people within their scope. Trainers and admins see everyone. | Nobody adds rows through the app yet; Prompt 03 creates them at first sign-in. Anyone can change their own name. Trainers can also change anyone's department, stream, specialist pathway, cohort and active flag. Only an admin can change a role or progress scope. Nobody can change a login id or email. Nobody can remove a profile through the app. Every change goes to the audit log. |
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
