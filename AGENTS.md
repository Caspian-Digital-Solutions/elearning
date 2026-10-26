# AGENTS.md — CDS AI Academy Platform

Read this file and `docs/ARCHITECTURE.md` before any task. `docs/BUILD_PLAN.md` says what is built and what is next.

## The project
An internal learning website for Caspian Digital Solutions (CDS), a Malaysian digital agency. Staff log in with their CDS Google account, follow a personal learning path, read lessons, sit assessments, submit assignments and get rubric feedback. Trainers load content and mark work; managers see raw progress counts.

## Who you are working with
Bharg, the product owner, is **not a developer**. So:
- Before changing code, give a short plan in plain English: what you will change, which files, and how to check it worked.
- After changing code, explain what you did in three to six plain sentences, list any command Bharg must run, and say exactly what to click to test it.
- Define any technical term the first time you use it.
- Never ask Bharg to edit code by hand. If something needs a value only he has (a key, an email), tell him where to put it.
- If a step needs an account action (Supabase, Vercel, Google, GitHub), give numbered click-by-click instructions.

## Stack (do not swap without a recorded decision in docs/DECISIONS.md)
- Next.js 16 App Router, TypeScript strict mode, `src/` directory
- Tailwind CSS + shadcn/ui
- Supabase: Postgres, Auth (Google), Storage — via `@supabase/supabase-js` and `@supabase/ssr`
- Vercel hosting; Supabase and Vercel regions in Singapore
- Vitest for unit tests, Playwright for end-to-end tests
- Package manager: npm

## Non-negotiables
1. **No AI features in this platform.** No calls to Claude, OpenAI or any model API. Client work happens in Claude, not here.
2. **No client data.** The platform stores staff names, emails, progress, scores and submissions only.
3. **Row-level security on every table**, with explicit policies. No table is ever left open.
4. **The Supabase secret key never reaches the browser** and is never committed. Only `NEXT_PUBLIC_*` variables may appear in client code.
5. **Every server action and route handler checks who the user is and what role they have**, even if the page already did.
6. **People make decisions, the system suggests.** Placement results, certificates and role changes always need a named person to confirm; record who and when.
7. **Raw numbers in dashboards.** No AI-generated scores, health ratings or traffic-light judgements. Sorting and filtering instead.
8. **Rules that are still under approval live in `app_settings`, not in code** (e.g. placement thresholds).
9. **Audit log** for changes to roles, placements, marks, certificates and settings.
10. Use current Supabase conventions: publishable key (`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`), `proxy.ts` (not `middleware.ts`), `getClaims()` for auth checks. Do not copy older tutorials that use the anon key or `middleware.ts`.

## Working method
- **Branch:** implement on **`develop`**; release by merging to **`main`** per `docs/RUNBOOK.md`. Do not commit prompt work directly to `main` unless Bharg asks for a hotfix.
- **Before you commit feature work**, run `git branch --show-current`. If the answer is `main`, stop and move the work to `develop` (or a `cursor/…-f142` branch from `develop`). Do not commit prompts, migrations, or product features on `main`.
- Work in small steps. One prompt from `docs/prompts/` at a time.
- Database changes only through new numbered files in `supabase/migrations/`. Never edit a migration that has already been applied; add a new one.
- After database changes, run **`npm run db:push:dev`** on the development project only. Use **`npm run db:push:prod`** only when Bharg is releasing to production and can type the production project ref when the script asks.
- **Never** run `npm run db:push:prod`, `npm run db:check:prod`, `scripts/promote-content.ts` (real run), or `scripts/compare-rls-policies.ts` without Bharg typing the production ref. Do not run `demo:seed` or `demo:clear` on the live academy database.
- After database changes, regenerate types into `src/lib/types/database.ts`.
- Before saying a task is done, run: `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:rls`, `npm run test:e2e`, `npm run build`. Report the result honestly. If something fails, say so and fix it.
- At the end of each prompt, update `docs/BUILD_PLAN.md` (status, date, notes) and add a line to `CHANGELOG.md`.
- If a requirement is unclear, state your assumption in the plan, mark it "ASSUMPTION", and continue. Ask only if the answer changes what gets built.
- Never delete data, drop tables or reset the database without Bharg typing an explicit yes.

## Naming
- Database: `snake_case` tables (plural) and columns. Enums named `*_type` or `*_status`.
- Code: `camelCase` variables, `PascalCase` components, kebab-case file names for routes.
- Module codes F1–F9, P1–P10, L1–L3, S1–S8; domains C1–C9 — always written exactly so.
- Skill names: lowercase letters, numbers and hyphens, never containing "claude" or "anthropic".

## Language and tone in the interface
British English. Short, direct sentences. No exclamation marks, no emoji, no "Awesome!". Buttons say what they do ("Submit assignment", not "Go").

## Commands
- `npm run dev` — run locally at http://localhost:3000
- `npm run lint` · `npm run typecheck` · `npm test` · `npm run test:rls` · `npm run test:e2e` · `npm run build`
- `npm run db:push:dev` · `npm run db:push:prod` (prod asks you to type the ref)
- `npm run db:check:dev` · `npm run db:check:prod` (prod read-only; type the ref)
- `npx tsx scripts/promote-content.ts --dry-run` — cut-over content preview (dev → prod)
- `npx tsx scripts/compare-rls-policies.ts` — dev vs prod RLS names (read-only)
- `npm run db:types` — regenerate database types

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
