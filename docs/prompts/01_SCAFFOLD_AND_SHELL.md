# Prompt 01 — Scaffold the app and build the empty shell

**How to use:** open Cursor's Agent chat, switch to Plan mode if your version has it, paste everything between the lines, review the plan, then let it build. Expected time: 1–2 hours including checks.

---

You are building the CDS AI Academy platform. First read `AGENTS.md`, `docs/ARCHITECTURE.md` (sections 2, 4, 5, 11, 12) and `.cursor/rules/ui-design.mdc`. Follow them exactly.

## Goal
Create the Next.js project and a complete, clickable empty shell: every section of the site exists as a page with the right layout and navigation, but no real data yet. No database, no login in this step.

## Before writing code
Show me a plan in plain English: the commands you will run, the folders and files you will create, and how I will check the result. Wait for my "go".

## Tasks
1. **Create the project in this folder** without overwriting `AGENTS.md`, `CHANGELOG.md`, `README_PACK.md`, `.cursor/` or `docs/` (if the scaffolding tool refuses a non-empty folder, create it in a temporary folder and move the files in). Use the current stable `create-next-app` with: TypeScript, ESLint, Tailwind CSS, App Router, `src/` directory, import alias `@/*`, npm.
2. **TypeScript strict mode** on. Add scripts to `package.json`: `typecheck` (`tsc --noEmit`), `test` (Vitest), `test:e2e` (Playwright), `db:types` (placeholder that prints "set up in Prompt 02").
3. **shadcn/ui**: initialise and add button, card, input, label, textarea, badge, table, dropdown-menu, sheet, dialog, separator, avatar, skeleton, sonner, tabs, select, tooltip, breadcrumb.
4. **Design tokens and fonts** exactly as in `.cursor/rules/ui-design.mdc`: CSS variables in `globals.css` wired to shadcn/ui theme variables; DM Sans and Domine through `next/font/google`. Create `public/cds-logo.svg` as a simple placeholder wordmark "CDS AI Academy" (I will replace it with the real logo).
5. **Navigation config** in `src/config/navigation.ts`: one array describing every menu item with `label`, `href`, `icon` (lucide-react), `roles` allowed, `phase`, and `builtInPrompt`. Items and order:
   - Main: My path `/my-path` (Phase 1, Prompt 08) · Lessons `/lessons` (P1, 06) · Assessments `/assessments` (P1, 07) · Assignments `/assignments` (P1, 09) · Prompt library `/prompt-library` (Phase 2) · Skills catalogue `/skills` (Phase 2) · What changed `/what-changed` (P1, 05) · Progress `/progress` (P1, 10) · Rules and help `/help` (P1, 05) · Certificates `/certificates` (Phase 3)
   - Trainer area (trainer, admin; champion sees Marking queue only): Marking queue `/trainer/marking` (09) · Content `/trainer/content` (05–06) · Users `/trainer/users` (04) · Placements `/trainer/placements` (07)
   - Admin (admin only): Roles `/admin/roles` (04) · Settings `/admin/settings` (04) · Audit log `/admin/audit` (04)
6. **Placeholder current user** in `src/lib/auth/current-user.ts` exporting `getCurrentUser()` that returns a fixed demo user. In development only, read `DEV_PREVIEW_ROLE` (learner, champion, manager, trainer, admin) from `.env.local` so I can preview each role's menu. Mark the file clearly: "TEMPORARY — replaced in Prompt 03". It must return a learner in production builds.
7. **Layouts**
   - Route groups: `src/app/(auth)/login` (simple centred card with the logo, the line "Sign in with your CDS Google account", and a disabled button "Sign in with Google" labelled "Available after Prompt 03"), and `src/app/(app)/` for the signed-in shell.
   - Signed-in shell: sidebar on desktop (collapsible), sheet menu on phones, top bar with page title and user menu (name, role, "Sign out" disabled for now). Menu items filtered by the user's role from the navigation config.
   - `/` redirects to `/my-path`.
   - `src/app/setup-pending/page.tsx`: message "Your account is almost ready. A trainer will assign your department; you will then see your learning path. Questions: contact Mahgol." (no sidebar).
8. **Every page from the navigation exists**, plus detail routes `/lessons/[module]`, `/lessons/[module]/[lesson]`, `/assessments/[code]`, `/assignments/[id]`, `/skills/[name]`, `/help/[page]`. Each shows `PageHeader` (title + one-line purpose taken from ARCHITECTURE section 5) and `EmptyState` saying "Built in Prompt NN" or "Coming in Phase N". Trainer and admin layouts redirect users without the right role to `/my-path`.
9. **Shared components** in `src/components/shared/`: `PageHeader`, `EmptyState`, `StatusBadge`, `MarkdownView` (react-markdown + remark-gfm + rehype-sanitize, video embed allow-list per rules), `DataTable` (client component: sortable columns, text filter, CSV export button; demo it on the `/progress` page with 5 rows of obviously fake data labelled "Sample data").
10. **Not found and error pages** in the house style.
11. **Tests**: Vitest configured with one test for the navigation filter (a learner does not see Trainer or Admin items; a champion sees Marking queue only). Playwright configured with one smoke test: the home page redirects to `/my-path` and every main menu link opens a page with a heading.
12. **Hosting config**: `vercel.json` with `"regions": ["sin1"]` (Singapore).
13. **README.md** in plain English: what the project is, how to run it (`npm install`, `npm run dev`), how to preview roles with `DEV_PREVIEW_ROLE`, the checks to run, and a link to `docs/ARCHITECTURE.md`.
14. **`.env.example`** with `DEV_PREVIEW_ROLE` documented. Make sure `.env.local` is in `.gitignore`.
15. **Git and first deploy**: commit with message "Prompt 01: scaffold and shell". Then give me numbered click-steps to (a) push to the private GitHub repository `cds-ai-academy` and (b) import it in Vercel so I get a preview link. Do not ask me for any secret in chat.
16. Update `docs/BUILD_PLAN.md` (Prompt 01 status "Done", date, notes) and add a `CHANGELOG.md` line.

## Out of scope for this prompt
Database, Supabase, real login, real content, any AI or external API.

## Done when (I will check each)
- [ ] `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` all pass (show me the output summary)
- [ ] `npm run dev` → http://localhost:3000 opens My path with the CDS colours and fonts
- [ ] Every sidebar link opens a page with a heading and a sensible empty state
- [ ] Setting `DEV_PREVIEW_ROLE=learner` hides Trainer and Admin; `trainer` shows Trainer area; `admin` shows both; `champion` shows only Marking queue in the Trainer area
- [ ] Typing `/admin/settings` as a learner sends me back to My path
- [ ] On a phone-width window (360px) the menu becomes a slide-out sheet and nothing scrolls sideways
- [ ] `/progress` shows the sample table; sorting, filtering and CSV export work
- [ ] Vercel preview link loads the same shell
- [ ] BUILD_PLAN.md and CHANGELOG.md updated

When finished, summarise in plain English what you built, anything you assumed, and what I should click to check it.
