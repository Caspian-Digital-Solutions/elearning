# DECISIONS.md — Platform design decisions

Mirrors the platform entries in the Academy's DECISION_LOG.md. All PROPOSED until Bharg (and, where noted, management) approves. Cursor must not contradict an entry here; to change one, add a new entry that supersedes it.

| ID | Date | Decision | Reason | Alternatives rejected | Status |
|---|---|---|---|---|---|
| DL-019 | 2026-10-20 | Next.js 16 (React, TypeScript) on Vercel, with Supabase (Postgres, Auth, Storage); both in Singapore | Implements the React + Supabase + Vercel proposal in DL-016; Next.js adds server-side login checks; Singapore is the nearest region | Plain React single-page app; off-the-shelf LMS | PROPOSED |
| DL-020 | 2026-10-20 | The platform has no AI features of its own | Keeps client work in Claude, avoids a second AI governance surface and API cost | Embedded chatbot or AI marking | PROPOSED |
| DL-021 | 2026-10-20 | Sign-in with Google, CDS Workspace accounts only (Internal consent screen + database domain check); new accounts wait in "setup pending" until a trainer assigns a department | Staff already use Google Workspace; no passwords to manage | Email magic links; open sign-up | PROPOSED (D11) |
| DL-022 | 2026-10-20 | Five roles (learner, champion, manager, trainer, admin) plus a separate progress scope (self, department, all), enforced by row-level security; individual test scores visible to the learner, trainers and admin only | Clear, testable access; protects staff from score exposure | Role-only visibility rules | PROPOSED (scores: D4) |
| DL-023 | 2026-10-20 | Basic assignment submission and marking move from Phase 2 into Phase 1 | F3, F4 and F5 are assessed in Weeks 2–3 | Spreadsheet marking until Week 5 | PROPOSED (updates DL-016) |
| DL-024 | 2026-10-20 | Placement and certification thresholds stored as editable settings, not in code; the system suggests, a named trainer confirms | DL-002/003 are still proposals; decisions stay with people | Hard-coded thresholds; automatic placement | PROPOSED |
| DL-025 | 2026-10-20 | Lessons and help pages stored as Markdown in the database and edited in the platform by trainers; recordings linked from Drive, not hosted | Mahgol can load content without a developer; lower storage cost | Content files in Git; video hosting | PROPOSED |
| DL-026 | 2026-10-20 | Data rules page requires each person to confirm every new version; banner until confirmed; raw list of who has not confirmed for trainers | Week 0 safety baseline and evidence for governance | — | PROPOSED |
