# Start here — CDS AI Academy platform build pack

This folder becomes the start of the code repository. Cursor reads it to understand what to build and how.

## What is in the pack
| File | What it is | Who reads it |
|---|---|---|
| `AGENTS.md` | Standing instructions for Cursor: stack, non-negotiables, how to talk to you | Cursor, every request |
| `.cursor/rules/*.mdc` | Detailed rules for the database, login, interface and tests; load automatically when Cursor touches those files | Cursor |
| `docs/ARCHITECTURE.md` | The full system design: roles, pages, data model, security, phases, cost, glossary | You, R&D, Cursor |
| `docs/seed/curriculum_v1_1.json` | Stages, C1–C9, departments, 30 modules, settings, taken from CURRICULUM_MASTER v1.1 | Cursor (Prompt 02) |
| `docs/prompts/00_SETUP_CHECKLIST.md` | Accounts and settings you create by hand | You |
| `docs/prompts/01–03_*.md` | The three skeleton prompts to paste into Cursor | You → Cursor |
| `docs/BUILD_PLAN.md` | Every prompt from 00 to 18, with status | You and Cursor |
| `docs/DECISIONS.md` | Platform decisions DL-019 to DL-025 | You and Cursor |

## How to run each prompt
1. Open the prompt file, copy the text between the horizontal lines.
2. In Cursor, open a **new** Agent chat (one chat per prompt keeps it focused). Switch to Plan mode if your version offers it.
3. Paste. Read the plan it gives back. If anything is unclear, ask it to explain in plain English before saying "go".
4. Let it work. Approve terminal commands when it asks, except anything that deletes data or touches production.
5. Go through the "Done when" checklist yourself. If a box fails, tell Cursor which one and what you saw.
6. When every box is ticked, check that it committed, and that `docs/BUILD_PLAN.md` shows the prompt as Done.
7. Come back to the Claude Project for the next prompt. Bring the summary Cursor gave you, so Prompt 04 is written against what was actually built.

## Three habits that prevent most problems
- **Secrets go in `.env.local` or dashboards, never in chat.**
- **One prompt per chat, one commit per prompt.** If something goes badly wrong, you can roll back to the last good commit.
- **Dev first.** Nothing touches the production database until Prompt 11.
