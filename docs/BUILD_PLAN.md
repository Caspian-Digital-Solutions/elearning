# BUILD_PLAN.md — CDS AI Academy Platform

Cursor updates the Status, Date and Notes columns at the end of every prompt. Full prompt text lives in `docs/prompts/`. Prompts 04 onwards are written one at a time, after the previous prompt is checked, so each one reflects what was actually built.

## Skeleton (this pack)

| # | Prompt | Delivers | Depends on | Status | Date | Notes |
|---|---|---|---|---|---|---|
| 00 | Setup checklist | Laptop, GitHub, Vercel, Supabase dev, Google OAuth | — | In progress | 2026-10-20 | Bharg + Workspace admin. A–C done (Prompt 01 is live on Vercel). D: Supabase dev project exists (ref `qayhizszqgubbseevtwq`). Its database answers on the ap-northeast-2 (Seoul) pooler, not Singapore as ARCHITECTURE and AGENTS.md specify; fine for dev, decide before production (Prompt 11). E (Google sign-in): code ready in Prompt 03; the Google OAuth client, Supabase Google provider, hook and URL settings are Bharg's dashboard steps, not yet confirmed done. |
| 01 | Scaffold and shell | Next.js app, design system, every page as a stub, role-filtered menus, first Vercel preview | 00 A–C | Done | 2026-10-20 | Next.js 16.4 empty shell, CDS colours, role-filtered menu, sample progress table. No database yet. Live Vercel URL was publishing only `public/` until `vercel.json` sets the framework to Next.js. |
| 02 | Database foundation | Supabase connection, reference/people/content/progress/audit tables, RLS, curriculum seed | 01, 00 D | Done | 2026-10-20 | Merged to main (PR #3). Applied to the dev project with `db push --include-seed` over the session pooler. Counts checked by SQL on dev: departments 10, domains 9, stages 6, modules 30, module domains 57, requirements 33, settings 5, pages 5. RLS on all 15 tables; advisors clean. Not yet run: `npm run db:check` on Bharg's laptop, which needs the secret key in `.env.local`; the same counts were checked by SQL instead. Access rules in `docs/ACCESS_RULES.md`. |
| 03 | Login and roles | Google sign-in (CDS only), profiles, route protection, first admin, access-rule tests | 02, 00 E | In review | 2026-10-20 | Skeleton complete in code. Migration `20261020100001_sign_in.sql` (hook, profile trigger, second domain lock) applied to dev. `test:rls`: 25 cases pass on dev and leave nothing behind. Playwright signed-out checks pass on a local copy. Still to do by Bharg: Google OAuth client, Supabase Google provider on and Email off, Before User Created hook, URL Configuration, first sign-in and the first-admin SQL; then check sign-in on the live link. Signed-in Playwright checks (sidebar, setup-pending) wait for a test sign-in method. |

## Phase 1 — before Week 0

| # | Prompt | Delivers | Depends on | Status |
|---|---|---|---|---|
| 04 | Users and settings | Trainer Users screen (assign department, stream, cohort, activate/deactivate); Admin Roles screen; Admin Settings editor for `app_settings` with validation; Audit log viewer with filters | 03 | Planned |
| 05 | Rules and help, What changed | Markdown editor (write/preview) in Trainer › Content; help pages; What changed feed and editor; draft/publish workflow with version number | 04 | Planned |
| 06 | Lessons | Lessons by module and stage; lesson reader; mark as complete; trainer lesson editor with department targeting; video links | 05 | Planned |
| 07 | Week 0 assessment | Assessment, section, item, attempt, response, placement tables; profile questions, MCQ, scenarios, practical items; auto-scoring of MCQ; trainer marking of practical items; placement suggestion from `app_settings` (pure functions + boundary tests); trainer confirmation screen | 06 | Planned. Engine built on sample items; real questions loaded after Batch 2 (Deliverables 3–4) |
| 08 | My path | Learner plan generator (stream + department requirements + bridges), trainer override with reason; My path page: this week, due, may skip, done | 07 | Planned |
| 09 | Assignments and marking | Rubric tables with anchored levels; assignment briefs; submission (link, file, text) with data declaration; private file storage; marking queue; double-marking for Champions; release feedback | 08 | Planned. Proposed move from Phase 2 (F3–F5 are assessed in Weeks 2–3) |
| 10 | Progress (basic) | Self view; department and all-staff views by progress scope; raw counts, sort, filter, CSV export | 09 | Planned |
| 11 | Hardening and launch | Production Supabase (Pro, Singapore) and Vercel production; domain; backups check; security review pack for R&D; content loading guide for Mahgol; pilot with Champions | 10, D11 approval | Planned |

## Phase 2 — by Week 5
| # | Prompt | Delivers |
|---|---|---|
| 12 | Prompt library | Prompt entries by department, task and tool; tested/retired status; copy button; owner and version |
| 13 | Skills catalogue | Catalogue entries for the seven certification Skills and others; lowercase-hyphen name check; status flow draft → in review → live → retired; how to switch it on in Claude; usage logs for department certification |
| 14 | Practitioner content and time logs | Practitioner lessons; baseline tasks and time logs (raw minutes) |

## Phase 3 — by Week 13
| # | Prompt | Delivers |
|---|---|---|
| 15 | Certificates | Eligibility check (suggests), trainer/Bharg issues; numbered PDF certificate |
| 16 | Management view and Jira export | Senior management progress view; CSV export shaped for the Academy Jira board (a person updates Jira) |
| 17 | Specialist content | S1–S8 lessons, pathway filters, capstone submissions |

## Phase 4 — after Week 20
| # | Prompt | Delivers |
|---|---|---|
| 18 | New-joiner path and upkeep | Onboarding path for new staff; content review dates and reminders; quarterly review report |
