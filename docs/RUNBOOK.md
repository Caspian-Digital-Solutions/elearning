# Release and operations runbook

Plain-English steps for CDS AI Academy after Prompt 11b. **Development** uses git branch `develop`, the development Supabase project (`qayhizszqgubbseevtwq` until renamed in the dashboard), and shows the DEVELOPMENT ribbon. **Production** uses `main`, project `cds-academy-prod`, hostname `https://ailearning.devteam-cds.tech`, and `APP_ENV=production`.

## Daily build (Cursor)

1. Check out **`develop`** and implement the prompt there.
2. When migrations change, run **`npm run db:push:dev`** (targets `DEV_PROJECT_REF` only).
3. Verify on the **development** Vercel preview URL (ribbon visible, development ref on `/admin/system`).
4. Run **`npm run lint`**, **`npm run typecheck`**, **`npm test`**, **`npm run test:rls`**, **`npm run test:e2e`**, **`npm run build`**.

## Release to production

1. Merge **`develop`** → **`main`** (or open a release PR).
2. **Before** or as Production deploy starts, run **`npm run db:push:prod`**. The script prints the production ref; type it exactly when prompted.
3. Confirm Vercel **Production** environment variables point at **`cds-academy-prod`** (not the dev ref) and `APP_ENV=production`.
4. After deploy, sign in on the live URL: no DEVELOPMENT ribbon; `/admin/system` shows the production ref and **sample content allowed: No**.
5. Check Vercel runtime logs for 15 minutes of normal use.

## One-time cut-over content (11b only)

1. **`npx tsx scripts/promote-content.ts --dry-run`** — review counts on the laptop.
2. **`npx tsx scripts/promote-content.ts`** — type production ref and **`yes`**. Second run needs **`--force --reason "..."`**.
3. **`npx tsx scripts/compare-rls-policies.ts`** — dev vs prod policy names must match (read-only).

## Roll back application code

1. Vercel → **Deployments** → previous Production deployment → **Promote to Production**.
2. No database change. Previous code must still work with the current schema (forward-only migrations).

## Roll back database data

1. Supabase → **`cds-academy-prod`** → **Database** → **Backups** → restore a daily backup.
2. **Warning:** restores overwrite all data since that backup. The development project is not affected.

## Keys and access

| Secret | Where it lives | Who |
|--------|----------------|-----|
| Publishable key | Vercel env (per environment) | Developers via dashboard |
| Secret key | Vercel Production / Preview only; laptop `.env.local` for scripts | Bharg, backup admin `admin@caspiands.com`, R&D lead |
| `SUPABASE_DB_URL` | Laptop only for `test:rls` and policy compare | Developers |

Rotate the production secret in Supabase → API Keys, then update Vercel Production and redeploy.

## People and access

- **Add admin:** Admin → Roles; use reason text (audited). Backup admin account: **`admin@caspiands.com`** (not `bhargava@caspainds.com` — domain typo).
- **Lockout:** Mahgol or Bharg promotes/demotes via Admin → Roles.
- **Admin loss:** Backup admin; else R&D lead.

## Production command rule

Any script that writes to production prints **`About to run on PRODUCTION Supabase ref: …`** and requires typing that ref. Cursor must not run production commands without Bharg present to type the ref.
