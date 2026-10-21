/** Module card: how many published lessons the person completed. */
export function formatModuleProgress(completed: number, total: number): string {
  const c = Math.max(0, completed);
  const t = Math.max(0, total);
  return `${c} of ${t} complete`;
}

export function countCompleted(
  lessonIds: readonly string[],
  completedIds: ReadonlySet<string>,
): number {
  let n = 0;
  for (const id of lessonIds) {
    if (completedIds.has(id)) {
      n += 1;
    }
  }
  return n;
}
