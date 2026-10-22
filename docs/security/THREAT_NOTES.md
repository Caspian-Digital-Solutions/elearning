# Threat notes

| Risk | Mitigation | Test / setting |
|------|------------|----------------|
| Answer keys leak to learners | No RLS policy on `assessment_item_keys` for learners; API never selects keys | `access-matrix-sweep` trainer vs learner on keys |
| Learner reads another's submission | RLS on `submissions` owner-only | `tests/rls/access-rules.test.ts` |
| Self-promotion to admin | `protect_profile_privileges` trigger | RLS users-roles tests |
| Sample content in production | `APP_ENV=production` guards in server actions | `tests/security/production-content.test.ts` |
| Test accounts on production | Blocked at callback and `getCurrentUser` | Same |
| Leaked secret key | Server-only env; documented in SECURITY_OVERVIEW | `.env.example`; no `NEXT_PUBLIC_` on secret |
| Outsider email domain | Hook + profile trigger `is_allowed_sign_in_email` | Sign-in tests |
| Credential stuffing on OAuth callback | `auth.callback` rate limit per IP | `tests/rls/rate-limit.test.ts` |
| Accidental double-submit | Per-user rate limits on submit/save | attempt/assignment actions |
| Advisor: function search_path | Migration `20261028100000` sets `search_path` on new functions | Supabase db lint |

## Advisor follow-ups

Run `npx supabase db lint --linked` before each release. Any remaining lint items are listed in `TEST_EVIDENCE.md`.
