# Prompt 03 — Google sign-in, roles and route protection

**Before this prompt:** finish section E of `00_SETUP_CHECKLIST.md` (Google OAuth client with "Internal" consent screen; Google provider switched on in Supabase; Email provider off). Use a Claude Opus model. Expected time: 2–3 hours.

---

Read `AGENTS.md`, `docs/ARCHITECTURE.md` (sections 3, 4, 7.1, 9), `docs/ACCESS_RULES.md`, `.cursor/rules/nextjs-auth.mdc`, `.cursor/rules/database-supabase.mdc` and `.cursor/rules/testing.mdc`. Follow them exactly.

## Goal
Real sign-in with CDS Google accounts only, automatic profile creation, role-based access everywhere, and automated proof that the access rules work. After this prompt the skeleton is complete.

## Before writing code
Show me a plan: files to change, the new migration, the sign-in flow in five or six plain steps, and the dashboard settings I must change. Wait for my "go".

## Tasks

### A. Database (one new migration)
1. `hook_before_user_created(event jsonb)`: rejects any email whose domain is not in the allowed list (`caspiands.com`, kept as a clearly named constant at the top of the function with a comment "change only by logged decision"). Message: "Please sign in with your CDS Google account." Grant execute to `supabase_auth_admin`; revoke from `authenticated`, `anon`, `public`. `security definer`, `search_path = ''`.
2. `handle_new_user()` trigger on `auth.users` after insert: creates the `profiles` row (email, full name from Google metadata, role learner, scope self, no department). As a second lock, it raises an exception if the email domain is not allowed.
3. Tell me how to switch on the hook: Supabase → Authentication → Hooks → "Before User Created" → Postgres function `public.hook_before_user_created`. If the hook is unavailable on our plan, say so; the trigger in step 2 still blocks other domains.

### B. Sign-in flow
1. `/login`: logo, one line of explanation, button "Sign in with Google". Calls `signInWithOAuth` with provider `google`, `redirectTo` = `{site}/auth/callback`, query params `hd=caspiands.com` (a hint to Google, not the lock) and `prompt=select_account`. Shows the error message passed back from a failed attempt in plain English.
2. `/auth/callback` route handler: exchanges the code for a session, then redirects to `/my-path`, or back to `/login?error=...` with a readable message.
3. `src/proxy.ts` (Next.js 16; not `middleware.ts`): refreshes the session on every request and redirects signed-out visitors to `/login` (public: `/login`, `/auth/callback`, static files, `/favicon.ico`).
4. Replace the temporary `src/lib/auth/current-user.ts` with real functions in `src/lib/auth/`:
   - `getCurrentUser()` → uses `getClaims()`, then loads the profile (id, email, full_name, role, progress_scope, department, stream). Returns null if signed out.
   - `requireUser()` → redirects to `/login` if signed out.
   - `requireRole(roles)` → redirects to `/my-path` if the role is not allowed.
   - Keep `DEV_PREVIEW_ROLE` working **only** when `NODE_ENV=development` **and** the signed-in user is admin, to preview menus without changing the real role. Never in production builds.
5. `(app)/layout.tsx`: `requireUser()`; if role is learner and department is empty → `/setup-pending`. Trainer layout: trainer or admin (champion allowed into `/trainer/marking` only). Admin layout: admin only.
6. User menu: shows real name, department and role; "Sign out" works and returns to `/login`.
7. `/setup-pending`: shows the signed-in email and a "Sign out" button.

### C. First admin
Give me the exact SQL to run once in the Supabase SQL editor after my first sign-in, setting my profile (by email) to role `admin`, progress scope `all`. Explain that the SQL editor is trusted, so the privilege trigger allows it, and that every later role change happens in the app by an admin and is audited.

### D. Access-rule tests (automated)
1. Write `tests/rls/` tests run by `npm run test:rls`. They connect to the **dev** database with `SUPABASE_DB_URL`, open a transaction, create synthetic users and profiles (e.g. "Test Learner Content", "Test Manager Creative"), simulate each user by setting the `authenticated` role and JWT claims, run queries, assert results, and **roll back** so nothing is left behind.
2. Cover at least:
   - a learner reads own profile, not another learner's
   - a learner cannot change own role or progress scope (trigger blocks it)
   - a trainer can change a learner's department but not their role
   - only an admin can change a role, and the change appears in `audit_log`
   - a manager with department scope sees own department, not another
   - a signed-in user reads modules and published lessons, not draft lessons
   - a learner can mark and un-mark own lesson progress, not someone else's
3. Playwright: signed-out visit to `/my-path` lands on `/login`; `/login` shows the Google button.

### E. Vercel
1. Give me click-steps to add `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and `SUPABASE_SECRET_KEY` in Vercel (Preview and Development environments only for now; `SUPABASE_SECRET_KEY` must not have the `NEXT_PUBLIC_` prefix).
2. Tell me the exact redirect URL pattern to add in Supabase → Authentication → URL Configuration for Vercel previews of this project.

### F. Finish
Commit "Prompt 03: Google sign-in, roles, access tests". Update `docs/BUILD_PLAN.md` (mark the skeleton complete), `docs/ACCESS_RULES.md` (add the sign-in rules) and `CHANGELOG.md`.

## Out of scope
User management screens (Prompt 04), any content screens, production project.

## Done when
- [ ] I sign in with my CDS Google account and land on "Your account is almost ready"
- [ ] After running the first-admin SQL and refreshing, I see My path with Trainer area and Admin in the menu
- [ ] A personal Gmail account cannot sign in (Google refuses it, or the app shows the plain-English message)
- [ ] Signing out returns me to `/login`; opening `/my-path` signed out sends me to `/login`
- [ ] `npm run test:rls` passes every case and leaves no test users behind (check Authentication → Users)
- [ ] `npm run lint`, `typecheck`, `test`, `test:e2e`, `build` pass
- [ ] Sign-in works on the Vercel preview link
- [ ] Docs and changelog updated

Finish with a plain-English summary of how sign-in and access work now, in no more than eight sentences, plus anything you assumed.
