# Admin guide (Bharg and backup admin)

## Roles and settings

- **Roles:** change role and progress scope with a reason (audit log).
- **Settings:** placement bands, marking thresholds, stream rules — each change needs a reason.

## Audit log

- **Admin → Audit log:** who changed what. Export CSV for investigations.

## People and data (Prompt 11a)

- **People and data:** mark leavers (deactivates account, sets leaving date), download **personal data export** (ZIP of CSVs; submission **files** listed separately, not bundled).
- **Retention:** people past **12 months after leaving** (proposed) — review before any manual deletion. Deletion is always manual with reason and audit.

## Demo data

- `npm run demo:seed` and `demo:clear` are **development only** (`DEV_PROJECT_REF` must match). **Never run on the live academy database** `qayhizszqgubbseevtwq`.

## When something breaks

1. Check Vercel runtime logs and the error digest shown to the user.
2. Confirm deployment commit matches Git.
3. Escalate to R&D for infrastructure; use audit log for data questions.

## Before production (11b)

Read `docs/PRODUCTION_CUTOVER.md`. Requires **D11** cost approval and R&D sign-off on `docs/security/`.
