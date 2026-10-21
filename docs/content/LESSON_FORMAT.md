# Lesson import format

Mahgol and the curriculum team write one lesson per Markdown file. Trainers import these files in **Trainer › Content › Lessons**. Import creates **drafts only**; nothing is published until a trainer publishes in the editor.

## Front matter (required YAML between `---` lines)

| Field | Required | Rules |
|---|---|---|
| `module` | Yes | An existing module code, e.g. `F4` (case-insensitive; stored as seeded). |
| `title` | Yes | Plain text. |
| `slug` | No | Lowercase letters, numbers and hyphens. Made from the title if missing. Unique within the module. |
| `kind` | No | `lesson`, `recording`, or `worked_example`. Default `lesson`. |
| `duration_min` | Yes | Integer from 1 to 60. |
| `departments` | No | `all` or a YAML list of department codes, e.g. `[content, creative]`. Default `all`. |
| `order` | No | Position within the module (`sort_order`). Default 0. |
| `video` | No | Google Drive or YouTube URL only. |
| `resources` | No | List of `{ title, url }` objects. |
| `summary` | No | One or two sentences, max 300 characters. |

## Body

Markdown after the closing `---`. Use callouts:

- `> [!NOTE]`
- `> [!WARNING]`
- `> [!IMPORTANT]`

**Do not** embed images in import files (`![alt](url)`). Add images in the editor after import.

## Valid department codes

From the curriculum seed (active departments only for targeting):

| Code | Name |
|---|---|
| `content` | Content |
| `creative` | Creative |
| `performance` | Performance |
| `performance-seo` | Performance: SEO |
| `performance-paid` | Performance: Paid |
| `performance-analytics` | Performance: Analytics |
| `account-management` | Account Management |
| `senior-management` | Senior Management |

`finance-ops` and `tech-delivery` exist in the database but are inactive; do not use them until scope is approved.

## Example file

```markdown
---
module: F4
title: Anatomy of a prompt
slug: anatomy-of-a-prompt
kind: lesson
duration_min: 12
departments: all
order: 2
video: https://drive.google.com/file/d/FILE_ID/view
resources:
  - title: Prompt template (Google Doc)
    url: https://docs.google.com/document/d/DOC_ID/edit
summary: The six parts of a prompt that reliably gets a usable first draft.
---

# Anatomy of a prompt

A strong prompt names the task, the audience and the output format.

> [!NOTE]
> Keep client names out of examples.

## The six parts

1. Role
2. Task
3. Context
```
