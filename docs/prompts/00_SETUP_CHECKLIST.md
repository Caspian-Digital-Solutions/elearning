# 00 — Setup checklist (you do this, not Cursor)

Time: about 90 minutes, spread across two sittings. Do sections A–C before Prompt 01, D before Prompt 02, E before Prompt 03.

Keep a private note (not in Cursor chat, not in Slack) for the values marked (secret). You will paste them into a file called `.env.local` or into dashboards, never into a chat window.

---

## A. Your laptop
1. Install **Node.js LTS** from nodejs.org (the version marked "LTS"). Accept the defaults.
2. Install **Git** if `git --version` in Terminal says it is missing (on a Mac, running that command offers to install it).
3. Open **Cursor** → Settings → Models: choose a Claude model (Sonnet for everyday steps, Opus for the database and login prompts).
4. Cursor → Settings → Rules: confirm "Include AGENTS.md" (or equivalent) is on. Project rules in `.cursor/rules/` load automatically.

## B. GitHub (where the code is stored)
1. Ask R&D which GitHub organisation CDS uses. Create a **private** repository there called `cds-ai-academy`. Do not add a README (the pack has one).
2. In Cursor: File → Open Folder → create a new empty folder `cds-ai-academy` on your laptop.
3. Copy the whole contents of this pack into that folder, keeping the structure (`AGENTS.md`, `.cursor/`, `docs/`, `CHANGELOG.md`, `README_PACK.md`).
   - On a Mac, `.cursor` is a hidden folder. In Finder press `Cmd + Shift + .` to see it.

## C. Vercel (hosting)
1. Sign up at vercel.com **with your CDS Google account** and connect GitHub.
2. Choose the **Pro** plan for production use (the free Hobby plan is for non-commercial use). If budget approval (D11) is still pending, start on Hobby for private testing only and upgrade before staff use it.
3. Do not create the project yet; Prompt 01 tells you when.

## D. Supabase (database and login) — before Prompt 02
1. Sign up at supabase.com with your CDS Google account. Create an organisation "Caspian Digital Solutions".
2. New project:
   - Name: `cds-academy-dev`
   - Region: **Southeast Asia (Singapore)**
   - Database password: generate a strong one (secret) (save it in your private note)
   - Plan: Free is fine for this dev project
3. When it is ready, collect from **Project Settings**:
   - Project URL (secret) (looks like `https://abcd.supabase.co`)
   - Project ref (secret) (the `abcd` part)
   - **Publishable key** (secret) (Settings → API Keys; starts with `sb_publishable_`)
   - **Secret key** (secret) (same page; starts with `sb_secret_`). Treat this like a bank PIN.
   - Database connection string (secret) (Connect → "Session pooler"), with your password filled in. Needed for automated access-rule tests.
4. Production project (`cds-academy-prod`, Pro plan, Singapore) is created later, in Prompt 11, after D11 approval.

## E. Google sign-in — before Prompt 03
This needs a **Google Workspace admin** for caspiands.com. If that is not you, send them this section.
1. Go to console.cloud.google.com → create project `CDS AI Academy`.
2. APIs & Services → **OAuth consent screen** (Google Auth Platform → Branding/Audience):
   - User type: **Internal** (this alone stops anyone outside caspiands.com from signing in)
   - App name: CDS AI Academy · Support email: your CDS email · Logo optional
   - Scopes: only `email`, `profile`, `openid`
3. Clients → **Create OAuth client** → Web application:
   - Name: `CDS Academy Supabase`
   - Authorised redirect URI: `https://<your-project-ref>.supabase.co/auth/v1/callback`
4. Copy the **Client ID** (secret) and **Client secret** (secret).
5. In Supabase → Authentication → Sign In / Providers → **Google**: switch on, paste Client ID and secret, save. Switch **Email** provider off.
6. Supabase → Authentication → URL Configuration:
   - Site URL: `http://localhost:3000` for now
   - Redirect URLs: add `http://localhost:3000/**` and your Vercel preview pattern (Prompt 03 tells you the exact value)

## F. Values you will need (checklist)
| Value | Needed by | Goes into |
|---|---|---|
| Supabase project URL | Prompt 02 | `.env.local` and Vercel |
| Supabase project ref | Prompt 02 | Terminal command (`supabase link`) |
| Supabase publishable key | Prompt 02 | `.env.local` and Vercel |
| Supabase secret key | Prompt 02 | `.env.local` and Vercel (server only) |
| Database password / connection string | Prompt 02–03 | Terminal prompt and `.env.local` (tests only) |
| Google Client ID and secret | Prompt 03 | Supabase dashboard only |
| Your CDS email (first admin) | Prompt 03 | One SQL command, run by you |
| Mahgol's CDS email | Prompt 04 | Users screen |
