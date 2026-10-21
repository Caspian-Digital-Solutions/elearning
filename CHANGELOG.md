# CHANGELOG.md — CDS AI Academy Platform

| Date | Prompt | Change |
|---|---|---|
| 2026-10-21 | 06 | Lessons reader and trainer editor: module overviews, draft/publish for lessons, secure content images, video embeds, bulk Markdown import, learner progress. Migrations applied to dev. |
| 2026-10-20 | 05 | Help pages, What changed and content editor: draft/publish workflow (`content_drafts`, `content_revisions`, `publish_content`), Trainer › Content, learner Rules and help with search and acknowledgements, What changed feed with unread badge, Markdown editor with callouts. Migration applied to dev. `test:rls` 54 cases. |
| 2026-10-20 | 04 | Users, roles, settings and audit log: Trainer › Users with counts, filters, edit panel, bulk changes, cohorts and a set-up-pending badge; Admin › Roles with required reasons and a last-admin guard; Admin › Settings with checked forms and a before/after preview; Admin › Audit log with reasons, filters and CSV; paused-access page. Three database functions for these changes, inactive people lose all rights, `last_seen_at`, cohort archive. `test:rls` now 49 cases. Migration applied to dev. |
| 2026-10-20 | 03 | Google sign-in for CDS accounts only (Before User Created hook plus a second lock in the profile trigger), automatic learner profile, proxy and layout protection by role, sign-out, setup-pending page, access-rule tests (`npm run test:rls`, 25 cases, rolled back), signed-out Playwright checks. Migration applied to dev. |
| 2026-10-20 | 02 | Applied the six migrations and the curriculum seed to the dev Supabase project; counts, RLS and advisors checked there |
| 2026-10-20 | 02 | Database foundation: Supabase connection and environment check, 15 tables in 6 migrations with row-level security on every table, audit log, curriculum seed (10 departments, C1–C9, 6 stages, 30 modules), `db:check`, generated types, `docs/ACCESS_RULES.md`. Waiting for the push to the dev project. |
| 2026-10-20 | 01 | Tell Vercel this project is Next.js, so it builds the app instead of publishing only the public folder |
| 2026-10-20 | 01 | Empty clickable shell: every page, role-filtered menu, sample progress table |
| 2026-10-20 | Pack | Architecture v1.0, AGENTS.md, Cursor rules, curriculum seed data, prompts 00–03, build plan, decisions DL-019 to DL-025 |
