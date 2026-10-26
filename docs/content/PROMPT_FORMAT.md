# Prompt library import format (JSON)

Trainers import **drafts only** from Trainer › Content › Prompts. Each file creates new rows in `draft` status.

## Top level

```json
{
  "prompts": [ … ]
}
```

## Prompt object

| Field | Required | Notes |
|-------|----------|-------|
| `title` | Yes | Plain text; SAMPLE titles are dev-only. |
| `slug` | Yes | Lowercase letters, numbers, hyphens; unique. |
| `task_type` | Yes | One of `library.task_types` in Admin › Settings. |
| `tool` | Yes | `claude`, `perplexity`, or `chatgpt`. |
| `risk_tier` | Yes | `low`, `medium`, or `high`. |
| `body` | Yes | Prompt text; placeholders as `{{client_brief}}`. Max 12 000 characters. |
| `usage_notes_md` | No | Markdown; how to use the prompt. |
| `example_md` | No | Fictional or anonymised example only. |
| `department_code` | No | Omit for everyone; otherwise a curriculum department code. |
| `module_code` | No | Optional module that teaches this prompt. |
| `is_sample` | No | Dev only; blocked when `APP_ENV=production`. |

## Placeholders

- Syntax: `{{name}}` where `name` starts with a letter and uses lowercase letters, digits, or underscores.
- Names must be unique within the body.

## Validation

The importer checks department and module codes, tool and risk values, slug rules, body length, and placeholder syntax. It does **not** publish or mark prompts as tested.
