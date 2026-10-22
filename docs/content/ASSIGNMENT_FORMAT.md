# Assignment import format (JSON)

Trainers import assignments in **Trainer › Content › Assignments**. Import always creates **drafts** only; publishing is separate (via **Publish** with a change note, same pipeline as lessons and pages).

Assignments use the **rubric tables** from Prompt 07 (`rubrics`, `rubric_criteria`, `rubric_levels`). Rubrics may be embedded in the import file or already exist in the database (import creates missing rubrics when the draft is saved or published).

## Top-level shape

```json
{
  "assignments": [
    {
      "code": "f4-prompt-practical",
      "title": "F4 rubric-marked prompt",
      "module_code": "f4",
      "brief_md": "...",
      "rubric_ref": "R-F4-PROMPT",
      "submission_types": ["link", "text"],
      "pass_mark_pct": 60,
      "is_test_out": false,
      "is_sample": false
    }
  ],
  "rubrics": [
    {
      "ref": "R-F4-PROMPT",
      "title": "Prompt practical",
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
  ]
}
```

## Assignment object

| Field | Required | Rules |
|---|---|---|
| `code` | Yes | Lowercase letters, numbers and hyphens (`f4-prompt-practical`, `week5-testout`). |
| `title` | Yes | Plain text. SAMPLE dev content should start with `SAMPLE`. |
| `module_code` | Yes | Module code from the curriculum seed (e.g. `f4`, `p1`). |
| `brief_md` | Yes | Markdown brief shown to learners before hand-in. |
| `rubric_ref` | Yes | Must match a `ref` in the file’s `rubrics` array (or an existing rubric when re-importing). |
| `submission_types` | Yes | Non-empty array; each value is `link`, `file` or `text`. Order is not significant. |
| `department_code` | No | When set, only learners in that department see the assignment for module completion. Omit for all departments. |
| `pass_mark_pct` | Yes | Whole number 0–100. Released mark percentage must meet or exceed this to pass. |
| `is_test_out` | Yes | When `true`, a passing released mark can call `apply_test_out_result` (e.g. Week 5 fast track). |
| `is_sample` | Yes | `true` for SAMPLE content used on dev only. |

### Test-out assignments (`week5-testout`, etc.)

Test-outs are assignments linked from `plan.stream_rules` → `test_outs[]` with `via: "assignment"` and `source_code` equal to the assignment `code`. They gate skipping Practitioner modules (e.g. P1–P2 after Week 5 for fast-track streams).

| Field | Typical Week 5 test-out |
|---|---|
| `code` | `week5-testout` |
| `module_code` | `p1` (curriculum anchor) |
| `pass_mark_pct` | `70` |
| `is_test_out` | `true` |
| `submission_types` | `link` and/or `file` (workflow evidence) |

On **Release feedback**, when `is_test_out` is true and stream rules match, the platform calls `apply_test_out_result` with the released mark (pass if total ≥ `pass_mark_pct`).

## Rubrics

Same rules as **`docs/content/ASSESSMENT_FORMAT.md`** (rubrics section):

| Field | Rules |
|---|---|
| `ref` | Unique in the file. Pattern: starts with `A–Z` or `0–9`, then `A–Z`, `0–9`, `_`, `-`. |
| `title` | Required. |
| `criteria` | At least one; each has `name`, `max_score` (≥ 0), and `levels` with unique `score` per criterion. |
| Level `score` | Whole number ≥ 0, not greater than the criterion `max_score`. |

The assignment’s maximum mark is the **sum of criterion `max_score` values** on the linked rubric. Import validation checks that the rubric exists and totals are consistent.

## Submission rules (enforced on submit, not in JSON)

- **Link:** `https` only; host must be `claude.ai`, `docs.google.com` or `drive.google.com`.
- **File:** Uploaded via `upload_submission_file` into the private `submissions` bucket (PDF, DOCX, PNG, JPG, TXT, MD; 10 MB).
- **Text:** Markdown in `text_md`.
- **Declaration:** Learners must confirm the data declaration on every attempt.

## Samples (dev seed scripts)

| File | Purpose |
|---|---|
| `docs/content/samples/f4_assignment_sample.json` | F4 SAMPLE rubric-marked prompt; `link` / `text`; 4×5 = 20 points; 60% pass. |
| `docs/content/samples/week5_testout_sample.json` | `week5-testout` on P1; `is_test_out`; `link` / `file`; 4×5 = 20 points; 70% pass. |

Run on dev (after migration):

- `npx tsx scripts/seed-f4-assignment-sample.ts`
- `npx tsx scripts/seed-week5-testout-sample.ts`

## Validation (Vitest + server)

Before drafts are stored, the import validator checks:

- Valid JSON and required top-level keys.
- Module and department codes exist in the curriculum / department lists.
- At least one submission type; `pass_mark_pct` 0–100.
- Rubric refs resolve; rubric structure and positive maximum total.
- No duplicate `code` values in one file.
