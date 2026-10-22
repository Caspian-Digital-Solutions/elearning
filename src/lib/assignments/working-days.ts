const KL_TIME_ZONE = "Asia/Kuala_Lumpur";

/** Calendar date in Malaysia (YYYY-MM-DD) for an instant. */
export function klDateString(instant: Date): string {
  return instant.toLocaleDateString("en-CA", { timeZone: KL_TIME_ZONE });
}

function parseKlDate(dateStr: string): { y: number; m: number; d: number } {
  const [y, m, d] = dateStr.split("-").map((part) => Number.parseInt(part, 10));
  return { y, m, d };
}

function utcMidnight({ y, m, d }: { y: number; m: number; d: number }): Date {
  return new Date(Date.UTC(y, m - 1, d));
}

function addUtcDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function isWeekdayUtc(date: Date): boolean {
  const day = date.getUTCDay();
  return day >= 1 && day <= 5;
}

/**
 * Working days elapsed after the submission calendar day (Malaysia) until the
 * as-of calendar day. Same calendar day → 0. Weekends are not counted.
 */
export function workingDaysWaiting(submittedAt: Date, asOf: Date = new Date()): number {
  const start = utcMidnight(parseKlDate(klDateString(submittedAt)));
  const end = utcMidnight(parseKlDate(klDateString(asOf)));
  if (end <= start) {
    return 0;
  }
  let cursor = addUtcDays(start, 1);
  let count = 0;
  while (cursor <= end) {
    if (isWeekdayUtc(cursor)) {
      count += 1;
    }
    cursor = addUtcDays(cursor, 1);
  }
  return count;
}
