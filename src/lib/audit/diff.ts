export type FieldChange = { field: string; before: string; after: string };

/** Fields the audit log does not show: bookkeeping, not decisions. */
export const ignoredAuditFields = ["id", "created_at", "updated_at", "last_seen_at", "updated_by"];

function flatten(value: unknown, prefix: string, out: Map<string, unknown>) {
  if (Array.isArray(value)) {
    if (value.length === 0) {
      out.set(prefix, "[]");
    }
    value.forEach((item, index) => flatten(item, `${prefix}[${index + 1}]`, out));
    return;
  }
  if (typeof value === "object" && value !== null) {
    const entries = Object.entries(value);
    if (entries.length === 0 && prefix) {
      out.set(prefix, "{}");
    }
    for (const [key, item] of entries) {
      flatten(item, prefix ? `${prefix}.${key}` : key, out);
    }
    return;
  }
  out.set(prefix, value);
}

export function formatValue(value: unknown): string {
  if (value === undefined || value === null || value === "") {
    return "empty";
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "boolean") {
    return value ? "yes" : "no";
  }
  return JSON.stringify(value);
}

/**
 * The fields that differ between two versions of a record, nested values
 * included (for example `value.bands[2].min`). Arrays are numbered from 1.
 */
export function changedFields(
  before: unknown,
  after: unknown,
  ignore: readonly string[] = ignoredAuditFields,
): FieldChange[] {
  const left = new Map<string, unknown>();
  const right = new Map<string, unknown>();
  flatten(before ?? {}, "", left);
  flatten(after ?? {}, "", right);

  const fields = [...new Set([...left.keys(), ...right.keys()])].filter((field) => {
    const top = field.split(/[.[]/)[0];
    return field !== "" && !ignore.includes(top);
  });

  return fields
    .filter((field) => JSON.stringify(left.get(field)) !== JSON.stringify(right.get(field)))
    .map((field) => ({ field, before: formatValue(left.get(field)), after: formatValue(right.get(field)) }));
}
