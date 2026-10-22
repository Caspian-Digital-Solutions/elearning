# Access matrix (generated)

Generated from `tests/rls/fixtures/access-matrix-cases.ts`. Run `npx tsx scripts/generate-access-matrix.ts` after edits.

| Persona | Operation | Target | Expected | Test |
|---|---|---|---|---|
| signed_out | insert | lesson_progress | deny | `signed_out insert on lesson_progress` |
| inactive | select | lessons | deny | `inactive select on lessons` |
| learner | select | profiles | allow | `learner select on profiles` |
| learner | select | audit_log | deny | `learner select on audit_log` |
| manager | select | attempts | deny | `manager select on attempts` |
| trainer | select | audit_log | deny | `trainer select on audit_log` |
| admin | select | audit_log | allow | `admin select on audit_log` |
| learner | select | assessment_item_keys | deny | `learner select on assessment_item_keys` |
| trainer | select | assessment_item_keys | allow | `trainer select on assessment_item_keys` |
| learner | insert | lesson_progress | allow | `learner insert on lesson_progress` |
