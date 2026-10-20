# CDS AI Academy

A private learning website for Caspian Digital Solutions staff. People sign in with their CDS Google account, follow a learning path, read lessons, sit assessments, and hand in assignments. Trainers load content and mark work. Managers see raw progress counts.

The pages and the menu are in place. The database (Supabase) holds the curriculum, with row-level security on every table; the pages start reading it once Google sign-in arrives in Prompt 03. The logo is a placeholder wordmark until the real CDS logo is added.

## Run it on your computer

1. Install Node.js 22 or newer.
2. In this folder, run `npm install`.
3. Copy `.env.example` to `.env.local` and fill in the Supabase values (the comments say where each one is).
4. Run `npm run dev`.
5. Open http://localhost:3000. The site opens on My path.

## Preview a role

Sign-in is not built yet. To see another role's menu, set `DEV_PREVIEW_ROLE` in `.env.local` to one of:

- `learner` (the default)
- `champion`
- `manager`
- `trainer`
- `admin`

Stop the site and run `npm run dev` again after you change it.

A learner does not see Trainer or Admin. A champion sees only Marking queue in the Trainer area. A trainer sees the Trainer area. An admin sees Trainer and Admin. This setting is ignored on the live site, which always shows a learner until real sign-in exists.

## Checks

- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run test:e2e`
- `npm run build`

## Database

Changes go only through new files in `supabase/migrations/`. Who can read and write each table is in [docs/ACCESS_RULES.md](docs/ACCESS_RULES.md).

- `npx supabase db push --include-seed` — apply new migrations and the curriculum seed to the linked dev project
- `npm run db:check` — count the seeded rows; fails if any count is wrong
- `npm run db:types` — regenerate `src/lib/types/database.ts` from the linked project
- `npm run db:seed:generate` — rebuild `supabase/seed.sql` from `docs/seed/curriculum_v1_1.json`

## Design

The full design is in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
