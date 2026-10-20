# CDS AI Academy

A private learning website for Caspian Digital Solutions staff. People sign in with their CDS Google account, follow a learning path, read lessons, sit assessments, and hand in assignments. Trainers load content and mark work. Managers see raw progress counts.

This first version is an empty shell. The pages and the menu are in place. There is no database and no real sign-in yet. The logo is a placeholder wordmark until the real CDS logo is added.

## Run it on your computer

1. Install Node.js 22 or newer.
2. In this folder, run `npm install`.
3. Copy `.env.example` to `.env.local`.
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

## Design

The full design is in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
