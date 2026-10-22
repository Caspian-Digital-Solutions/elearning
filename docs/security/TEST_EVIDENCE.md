# Test and audit evidence (Prompt 11a)

**Recorded:** 22 Oct 2026 (Cloud Agent run on commit Prompt 11a).

## Automated tests

| Command | Result |
|---------|--------|
| `npm run lint` | See CI output below |
| `npm run typecheck` | See CI output below |
| `npm run test` | See CI output below |
| `npm run test:rls` | See CI output below |
| `npm run test:e2e` | See CI output below |
| `npm run build` | See CI output below |

## Security headers

Configured in `next.config.ts` via `securityHeadersForEnv`. Unit tests: `tests/security/security-headers.test.ts`. Verify on Production in browser Network tab after deploy.

## `npm audit --omit=dev`

**7 high** findings in **dev-only** dependency chains (`shadcn` CLI → `fast-glob` → `micromatch` → `braces`). These packages are not shipped in the production Next.js runtime bundle.

| Package | Severity | Action |
|---------|----------|--------|
| braces / micromatch / fast-glob / ts-morph / @shadcn/registry / shadcn | High (stack exhaustion in glob matching) | **Accepted for 11a:** devDependency CLI only; upgrade shadcn major when vendor fixes without breaking codegen |

## Supabase advisors

| Check | Result |
|-------|--------|
| All `public` tables have RLS enabled | **Pass** (query on `qayhizszqgubbseevtwq`, 22 Oct 2026) |
| `npx supabase db lint --linked` | **Not run** — project not linked in this environment; run locally after `supabase link` |
| Migration `20261028100000` applied on dev DB | **Yes** (rate limits, leavers, privacy page, admin audit helper) |

## Demo seed

**Not run** on `qayhizszqgubbseevtwq` (live academy database).
