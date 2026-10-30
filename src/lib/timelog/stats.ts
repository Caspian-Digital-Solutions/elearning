/** Median of numeric values (each person counted once when passed per-person medians). */
export function median(values: readonly number[]): number | null {
  if (values.length === 0) {
    return null;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) {
    return sorted[mid] ?? null;
  }
  const a = sorted[mid - 1];
  const b = sorted[mid];
  if (a === undefined || b === undefined) {
    return null;
  }
  return (a + b) / 2;
}

export function minuteDifference(baselineMinutes: number, medianWithAi: number | null): number | null {
  if (medianWithAi === null) {
    return null;
  }
  return baselineMinutes - medianWithAi;
}

export type SmallGroupRule = {
  minGroupSize: number;
  viewerIsTrainerOrAdmin: boolean;
};

/** Hide a figure for managers when headcount is below minimum; trainers/admins always see it. */
export function visibleForGroup(headcount: number, rule: SmallGroupRule): boolean {
  if (headcount === 0) {
    return false;
  }
  const minimum = rule.viewerIsTrainerOrAdmin ? 2 : rule.minGroupSize;
  return headcount >= minimum;
}

export function smallGroupLabel(rule: SmallGroupRule): string {
  return `fewer than ${rule.minGroupSize} people — hidden`;
}

export function f7TimeLogLabel(loggedDistinctTasks: number, required: number): string {
  return `Time logs: ${loggedDistinctTasks} of ${required} tasks`;
}

export function f7Satisfied(loggedDistinctTasks: number, required: number): boolean {
  return loggedDistinctTasks >= required;
}

/** End of Friday programme week 2 in Malaysia (instant as UTC ms). */
export function week2LockEndMs(weekFridayYmd: string): number {
  return Date.parse(`${weekFridayYmd}T23:59:59+08:00`);
}

/** Whether a log is editable through end of 7th MY calendar day after created (UTC input). */
export function logEditableUntilMs(createdAtIso: string): number {
  const created = new Date(createdAtIso);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kuala_Lumpur",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(created);
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const d = parts.find((p) => p.type === "day")?.value;
  if (!y || !m || !d) {
    return 0;
  }
  const base = new Date(`${y}-${m}-${d}T00:00:00+08:00`);
  base.setDate(base.getDate() + 7);
  base.setHours(23, 59, 59, 999);
  return base.getTime();
}

export function isLogEditableNow(createdAtIso: string, nowMs = Date.now()): boolean {
  return nowMs <= logEditableUntilMs(createdAtIso);
}
