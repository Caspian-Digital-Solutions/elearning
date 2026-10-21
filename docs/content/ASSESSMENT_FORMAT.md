# Assessment import format (JSON)

Trainers import assessments in **Trainer › Content › Assessments**. Import always creates a **draft**; publishing is separate and is blocked while validation reports errors.

Week 0 placement assessments must align with **`placement.week0_sections`** in Admin › Settings (seeded from `docs/seed/curriculum_v1_1.json`).

On import, **option points**, **model answers**, **explanations** and **marking notes** are stored in `assessment_item_keys` only. Learner-visible `options` keep `{ id, text }` — never points.

## Top-level shape

```json
{
  "assessment": {
    "code": "week0",
    "title": "Week 0 diagnostic",
    "type": "placement",
    "instructions_md": "...",
    "time_guide_min": 120,
    "is_sample": false
  },
  "sections": [
    {
      "code": "knowledge",
      "title": "Knowledge",
      "max_score": 25,
      "counts_in_total": true,
      "instructions_md": "..."
    }
  ],
  "rubrics": [
    {
      "ref": "R-PROMPT-1",
      "title": "Prompting practical",
      "criteria": [
        {
          "name": "Context given",
          "max_score": 5,
          "levels": [
            { "score": 0, "descriptor": "..." },
            { "score": 5, "descriptor": "..." }
          ]
        }
      ]
    }
  ],
  "items": [
    {
      "ref": "K01",
      "section": "knowledge",
      "type": "choice",
      "domain": "C1",
      "difficulty": 1,
      "points": 5,
      "prompt_md": "...",
      "options": [
        { "id": "a", "text": "...", "points": 0 },
        { "id": "b", "text": "...", "points": 5 }
      ],
      "explanation_md": "Shown to trainers after marking."
    },
    {
      "ref": "D-CONTENT",
      "section": "department",
      "type": "practical",
      "department": "content",
      "domain": "C2",
      "difficulty": 2,
      "points": 25,
      "response_format": "prompt_and_output",
      "rubric": "R-DEPT-TASK",
      "prompt_md": "...",
      "model_answer_md": "...",
      "marking_notes_md": "..."
    }
  ]
}
```

## Assessment object

| Field | Required | Rules |
|---|---|---|
| `code` | Yes | Lowercase letters, numbers and hyphens (`week0`, `f3-safety-quiz`). |
| `title` | Yes | Plain text. |
| `type` | Yes | `placement`, `quiz`, `safety_quiz` or `capstone`. Week 0 uses `placement` (no module). |
| `instructions_md` | Yes | Markdown shown before the attempt. |
| `time_guide_min` | Yes | Positive whole number (soft time guide, not a hard limit). |
| `is_sample` | Yes | `true` for SAMPLE content (e.g. dev testing). |
| `module` | For `quiz` / `safety_quiz` | Module code (e.g. `F1`, `F3`). Required for module quizzes; omit for `placement`. |
| `pass_mark_pct` | For quizzes | Whole number 0–100. Learner must meet or exceed this percentage to pass. Use `0` for a non-gating check (F1). |
| `max_attempts` | No | Whole number or omit for unlimited. When set, `start_attempt` refuses further tries unless a trainer allows a retake. |
| `items_per_attempt` | No | Draw this many `choice` items at random per attempt (fixed in `attempts.item_ids`). Omit to use all published choice items. Pool size must be ≥ this value. |
| `show_review_after_submit` | No | Default `true` for quizzes. Must be `false` for `placement` (Week 0). When true, learners may call `get_attempt_review` after submit. |

### Quiz and safety_quiz rules

- Must have a `module` that exists in the curriculum seed.
- Items must all be type **`choice`** (no profile, practical, or short text).
- Use a single section (e.g. `check` or `safety`) with `max_score` equal to the sum of drawn item points, or one point per item in the pool.
- See `docs/content/samples/f1_check_sample.json` and `f3_safety_quiz_sample.json` for SAMPLE imports.

## Sections

**Placement (`type: placement`)** — each section must match **`placement.week0_sections`**:

| Code | Title (seed) | `max_score` | `counts_in_total` |
|---|---|---:|---|
| `knowledge` | Knowledge | 25 | true |
| `prompting` | Prompting | 25 | true |
| `department` | Department task | 25 | true |
| `safety` | Safety and judgement | 15 | true |
| `workflow` | Workflow | 10 | true |
| `technical` | Technical supplement (optional) | `null` | false |

Rules:

- Every seeded section code must appear **once** in the import file.
- `max_score` and `counts_in_total` must match the settings row for that code.
- `title` and optional `instructions_md` are stored on the assessment version.

## Rubrics

| Field | Rules |
|---|---|
| `ref` | Unique. Pattern: starts with `A–Z` or `0–9`, then `A–Z`, `0–9`, `_`, `-`. |
| `title` | Required. |
| `criteria` | At least one; each has `name`, `max_score` (≥ 0), and `levels` with unique `score` per criterion. |
| Level `score` | Whole number ≥ 0, not greater than the criterion `max_score`. |

**Rubric maximum** = sum of criterion `max_score` values.

## Items

| Field | Required | Rules |
|---|---|---|
| `ref` | Yes | Unique per assessment. Same ref pattern as rubrics. |
| `section` | Yes | Must match a `sections[].code`. |
| `type` | Yes | `profile`, `choice`, `short_text`, `practical`. |
| `domain` | Yes | One of `C1`–`C9` (see below). |
| `difficulty` | Yes* | 1–3 for scored items. Omit for `profile`. |
| `points` | Yes | Whole number ≥ 0. |
| `prompt_md` | Yes | Markdown question text. |
| `options` | For `profile` / `choice` | At least two options with unique `id` and non-empty `text`. |
| `response_format` | For `short_text` / `practical` | `text`, `prompt_and_output`, or `link`. |
| `department` | Department section only | Required for `section: "department"`. Must be `content`, `creative`, or `performance`. Forbidden on other sections. |
| `rubric` | Practical; written items with points | Must reference a rubric in `rubrics`. |
| `model_answer_md`, `marking_notes_md`, `explanation_md` | No | Trainer-only; stored in keys. |

### Type-specific rules

- **`profile`**: `points` must be `0`. No `rubric`. Options are not scored. Optional `allow_multiple` (default `false`): when `true`, use at least two options and the learner may tick several; answers store `{ "option_ids": ["a","b"] }` (legacy single-select may use `option_id`).
- **`choice`**: Each option includes `points` (import only). Option `points` cannot exceed the item `points`. The **highest** option `points` must equal the item `points`. No `rubric`.
- **`short_text`** / **`practical`**: If `points` > 0, `rubric` is required and **rubric maximum must equal item `points`**. `practical` always requires a `rubric`.

### Section point totals

- For every section with a numeric `max_score` (except `department`), the **sum of item `points` in that section** must equal `max_score`.
- **`department` section**: learners only see items for their department. For each of `content`, `creative`, and `performance`, the sum of item points with that `department` must equal the section `max_score` (25 with default settings). The three department tasks are not added together.
- **`technical`**: `max_score` is `null` in settings; point totals are not checked against a maximum.

## Valid competency domain codes

From `docs/seed/curriculum_v1_1.json`:

| Code | Name |
|---|---|
| `C1` | AI and LLM literacy |
| `C2` | Prompting and context |
| `C3` | Output evaluation and verification |
| `C4` | Responsible use and data protection |
| `C5` | Reusable systems (templates, Projects, Skills) |
| `C6` | Knowledge and grounding |
| `C7` | Automation and integration |
| `C8` | Agentic design and oversight |
| `C9` | Workflow redesign and value |

## Valid department codes

Active departments (for `department` on items in the department section, use the three parent rows below):

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

`finance-ops` and `tech-delivery` are inactive in the seed; do not target them until scope is approved.

Week 0 **department tasks** use `content`, `creative`, and `performance` only (one scored practical per code, each summing to the section maximum).

## Validator rules (summary)

The server runs `validateAssessmentImport()` in `src/lib/assessments/import.ts` before import. It checks:

1. Valid JSON and required top-level keys.
2. Assessment metadata (code pattern, type, time guide, `is_sample`).
3. Sections present, unique, and matching `placement.week0_sections` (`max_score`, `counts_in_total`).
4. Rubrics well-formed; refs unique; criterion/level scores valid.
5. Item refs unique; sections exist; types, domains, difficulty, and prompts valid.
6. Department codes valid and only on department-section items.
7. Profile / choice / written rules (options, rubrics, response formats).
8. **Choice**: best option points = item points; no option points above item points.
9. **Rubric items**: rubric max = item points.
10. **Section totals** and **per-department totals** for the department section.

The validation report lists errors and per-section point sums (including per-department rows for `department`).

## Sample file

A full SAMPLE Week 0 that passes validation:

`docs/content/samples/week0_sample.json`

Import it on dev to exercise the engine before real curriculum content is ready.

## Minimal worked example

One choice item and one section (not a complete Week 0 — shown for field shape only):

```json
{
  "assessment": {
    "code": "week0",
    "title": "Example fragment",
    "type": "placement",
    "instructions_md": "Example only.",
    "time_guide_min": 60,
    "is_sample": true
  },
  "sections": [
    {
      "code": "knowledge",
      "title": "Knowledge",
      "max_score": 25,
      "counts_in_total": true,
      "instructions_md": ""
    }
  ],
  "rubrics": [],
  "items": [
    {
      "ref": "K-EX",
      "section": "knowledge",
      "type": "choice",
      "domain": "C1",
      "difficulty": 1,
      "points": 25,
      "prompt_md": "Fictional question text.",
      "options": [
        { "id": "a", "text": "Wrong", "points": 0 },
        { "id": "b", "text": "Right", "points": 25 }
      ]
    }
  ]
}
```

A real Week 0 import must include **all six** sections and reconcile points with the settings table above.
