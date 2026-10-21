export function extractProfileOptionIds(answer: Record<string, unknown> | undefined): string[] {
  if (!answer) {
    return [];
  }
  const multi = answer.option_ids;
  if (Array.isArray(multi)) {
    return multi.filter((id): id is string => typeof id === "string" && id.length > 0);
  }
  const single = answer.option_id;
  if (typeof single === "string" && single.length > 0) {
    return [single];
  }
  return [];
}

export type ProfileOption = { id: string; text: string };

export function optionTextById(options: readonly ProfileOption[], optionId: string): string {
  return options.find((o) => o.id === optionId)?.text ?? optionId;
}

/** Increment counts per (question ref, option label). */
export function tallyProfileResponses(
  rows: readonly { itemRef: string; answer: Record<string, unknown>; options: readonly ProfileOption[] }[],
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const ids = extractProfileOptionIds(row.answer);
    for (const optionId of ids) {
      const label = optionTextById(row.options, optionId);
      const key = `${row.itemRef}:${label}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return counts;
}
