# Prompt 02 — Database foundation, security rules and curriculum data

**Before this prompt:** finish section D of `00_SETUP_CHECKLIST.md` (Supabase dev project in Singapore, keys in your private note). Use a Claude Opus model in Cursor for this one. Expected time: 2–3 hours.

**Secrets:** when Cursor needs a key, it should tell you to paste it into `.env.local` yourself. If it asks you to paste a key into the chat, say no.

---

Read `AGENTS.md`, `docs/ARCHITECTURE.md` (sections 4, 6.1–6.3, 6.6, 6.8 audit_log, 9) and `.cursor/rules/database-supabase.mdc` and `.cursor/rules/nextjs-auth.mdc`. Follow them exactly.

## First, a check
Open `docs/BUILD_PLAN.md`. If Prompt 01 is not marked Done, or any of its "Done when" items failed, list them for me before starting. Prompt 01 is deployed at https://elearning-five-kappa.vercel.app.

## Goal
Connect the app to the Supabase dev project and create the foundation of the database: reference data, people, content, progress and the audit log, all with row-level security, plus the curriculum loaded from `docs/seed/curriculum_v1_1.json`. Assessment, assignment, library and certificate tables are **not** part of this prompt; they arrive with their features.

## Before writing code
Show me a plan: each migration file and what it creates, the RLS policy list per table in a simple table (table · who can read · who can write), and the commands I will run. Wait for my "go".

## Tasks

### A. Connect to Supabase
1. Install `@supabase/supabase-js`, `@supabase/ssr`, `server-only`, `zod`, and the Supabase CLI as a dev dependency (`supabase`).
2. Run `npx supabase init`. Then tell me the exact `npx supabase link --project-ref <ref>` command to run myself in Cursor's terminal (it will ask for the database password; I type it there, not in chat).
3. Add to `.env.example` (names and comments only): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` (server only), `SUPABASE_DB_URL` (tests only, dev database), `DEV_PREVIEW_ROLE`. Tell me to fill `.env.local`.
4. **Before pushing any code that needs these variables**, give me click-steps to add `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and `SUPABASE_SECRET_KEY` to the Vercel project (Production, Preview and Development; dev Supabase values for now; the secret key without a `NEXT_PUBLIC_` prefix). Otherwise the next Vercel deployment fails. `SUPABASE_DB_URL` stays on my laptop only.
5. Create `src/lib/env.ts` (Zod validation, clear error naming any missing variable; secret values never logged) and the three clients `src/lib/supabase/client.ts`, `server.ts`, `admin.ts` exactly as the rules describe. Use the publishable key, not the anon key.

### B. Migrations (in this order, one file each)
1. **Shared foundation**: `set_updated_at()` trigger function; enums `app_role` (learner, champion, manager, trainer, admin), `progress_scope_type` (self, department, all), `stream_type` (foundation, practitioner, practitioner_fast_track, champion), `specialist_pathway_type` (business, builder, technical), `content_status` (draft, published, archived), `plan_status` (required, optional, tested_out, bridge, not_applicable).
2. **Reference tables**: `departments` (with `parent_id` self-reference and `is_active`), `competency_domains`, `stages`, `modules` (code, title, stage_id, week_start, week_end, live_hours, async_hours, assessed_by, is_leadership, sort_order), `module_domains`, `department_domain_requirements`, `cohorts`, `app_settings` (key unique, value jsonb, note, updated_by).
3. **People**: `profiles` (id references `auth.users` on delete cascade; email unique; full_name; department_id; role default learner; progress_scope default self; stream; specialist_pathway; cohort_id; is_active default true). Helper functions `current_app_role()`, `has_role(variadic app_role[])`, `can_view_user(uuid)` (self always; department scope = same department or child departments of the viewer's department; all scope = everyone; trainer and admin = everyone). Trigger `protect_profile_privileges` that blocks changes to `role` and `progress_scope` unless the caller is admin, **or** the change comes from a trusted server context where `auth.uid()` is null (the Supabase SQL editor or secret-key scripts). Trainers may change department, stream, specialist_pathway, cohort_id, is_active. Learners may change only their own `full_name`.
4. **Content and progress**: `lessons` (as in ARCHITECTURE 6.3, unique (module_id, slug)), `lesson_progress` (unique user_id + lesson_id), `learner_plan` (unique user_id + module_id; reason; set_by), `pages`, `updates`.
5. **Audit**: `audit_log` and the generic `audit_row_change()` trigger, attached to `profiles` and `app_settings` now (other tables attach in later prompts). Audit rows are readable by admin only and cannot be updated or deleted by anyone through the API.
6. **Row-level security** for every table above, following the rules file. Specifically:
   - Reference tables and published `lessons`, `pages`, `updates`: any signed-in user reads; trainer and admin write. Draft content: trainer and admin only.
   - `profiles`: user reads own row; `can_view_user()` grants managers, trainers and admin; updates as per the trigger rules; no deletes through the API.
   - `lesson_progress`: owner reads and inserts own rows and deletes own (to un-mark); viewers per `can_view_user()` read.
   - `learner_plan`: owner reads; viewers per `can_view_user()` read; trainer and admin write.
   - `app_settings`: signed-in users read; admin writes.

### C. Curriculum data
1. Write `scripts/generate-seed.ts` that reads `docs/seed/curriculum_v1_1.json` and writes `supabase/seed.sql` (idempotent upserts keyed on code/slug/key). Add script `db:seed:generate`.
2. Seed contents: all departments (Finance and Operations and Tech delivery as **inactive**, note "Pending scope decision D3"), C1–C9, the stages, all 30 modules with their domains, department domain requirements, `app_settings` entries from the JSON (placement sections, gates, bands, certification rules — each keeps its "PROPOSED" note), and the five help pages as drafts with a one-line placeholder body. Certification Skills and department boundaries are **not** seeded yet; keep them in the JSON for Phase 2.
3. Tell me the command to apply migrations and seed to the **dev** project (for example `npx supabase db push --include-seed`, or the SQL editor if that fails).
4. Write `scripts/db-check.ts` (script `db:check`) that uses the secret key server-side to print row counts: departments 10, domains 9, stages 6, modules 30, module domains, requirements 33, settings, pages 5. It must exit with an error if any count is wrong.

### D. Types and checks
1. Set `db:types` to `supabase gen types typescript --linked > src/lib/types/database.ts` and run it.
2. Run the Supabase security and performance advisors (dashboard → Advisors, or the Supabase MCP if connected in Cursor). Fix every warning about RLS, unindexed foreign keys, or functions with a mutable search_path. Show me the before and after count.
3. Leave the pages unchanged: reading data needs a signed-in user, which arrives in Prompt 03.
4. Commit "Prompt 02: database foundation and curriculum seed". Update `docs/BUILD_PLAN.md` and `CHANGELOG.md`.

## Out of scope
Login, assessment and assignment tables, editing screens, any change to module codes, weeks, hours or domains.

## Done when
- [ ] `npm run db:check` prints the expected counts and exits cleanly
- [ ] In the Supabase dashboard → Table Editor, every table shows the "RLS enabled" label
- [ ] Advisors show no security warnings
- [ ] `npm run lint`, `typecheck`, `test`, `build` pass
- [ ] `.env.local` is not in Git (`git status` does not list it)
- [ ] The Vercel link still loads after the push (no build failure)
- [ ] The plain-English RLS table from the plan is saved as `docs/ACCESS_RULES.md`
- [ ] BUILD_PLAN.md and CHANGELOG.md updated

Finish with a plain-English summary: what exists in the database now, what protects it, and anything you assumed.
