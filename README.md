# CDS AI Academy

A private learning website for Caspian Digital Solutions staff. People sign in with their CDS Google account, follow a learning path, read lessons, sit assessments, and hand in assignments. Trainers load content and mark work. Managers see raw progress counts.

The pages and the menu are in place, and sign-in works with CDS Google accounts only. The database (Supabase) holds the curriculum, with row-level security on every table. The logo is a placeholder wordmark until the real CDS logo is added.

## Run it on your computer

1. Install Node.js 22 or newer.
2. In this folder, run `npm install`.
3. Copy `.env.example` to `.env.local` and fill in the Supabase values (the comments say where each one is).
4. Run `npm run dev`.
5. Open http://localhost:3000 and choose "Sign in with Google" with your CDS account.

Production staff URL: https://ailearning.devteam-cds.tech

### Screenshot and E2E test accounts

For signed-in Playwright runs, use the fixed accounts created by `npx tsx scripts/ensure-test-accounts.ts` (Test Learner / Test Trainer at `test-*-screenshots@caspiands.com`). They are marked `is_test_account` on `profiles` and are excluded from trainer user counts, placements lists, and quiz analytics. The script uses the Supabase Admin API; it does not delete these users mid-run.

## Sign-in and roles

- Only `caspiands.com` Google accounts can sign in. Anyone else sees "Please sign in with your CDS Google account."
- Your first sign-in creates your profile as a learner with no department. You see "Your account is almost ready" until a trainer gives you a department.
- A learner does not see Trainer or Admin. A champion sees only Marking queue in the Trainer area. A trainer sees the Trainer area. An admin sees Trainer and Admin.
- The full rules are in [docs/ACCESS_RULES.md](docs/ACCESS_RULES.md).

## Preview a role (admins, on your laptop only)

An admin can see another role's menu by setting `DEV_PREVIEW_ROLE` in `.env.local` to `learner`, `champion`, `manager`, `trainer` or `admin`, then running `npm run dev` again. It does nothing for anyone who is not an admin, does nothing on the live site, and never changes what the database allows. Leave it blank to see your real role.

## Checks

- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run test:e2e` — browser checks (signed-out visitors land on the sign-in page). Set `PLAYWRIGHT_BASE_URL` to override the default `http://127.0.0.1:3000` (for example the production URL).
- `npm run test:rls` — access-rule tests against the dev database; needs `SUPABASE_DB_URL` in `.env.local`. Every test is rolled back, so nothing is left behind.
- `npm run build`

## Database

Changes go only through new files in `supabase/migrations/`. Who can read and write each table is in [docs/ACCESS_RULES.md](docs/ACCESS_RULES.md).

- `npx supabase db push --include-seed` — apply new migrations and the curriculum seed to the linked dev project
- `npm run db:check` — count the seeded rows; fails if any count is wrong
- `npm run db:types` — regenerate `src/lib/types/database.ts` from the linked project
- `npm run db:seed:generate` — rebuild `supabase/seed.sql` from `docs/seed/curriculum_v1_1.json`

## Design

The full design is in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
