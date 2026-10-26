const timeZone = "Asia/Kuala_Lumpur";

/** Calendar date YYYY-MM-DD in Malaysia for an instant. */
export function malaysiaCalendarDate(instant: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

/** Whole calendar days a Skill has been live (inclusive of live_since day) in Malaysia. */
export function calendarDaysLive(liveSince: string, todayMy: string): number {
  const start = parseMyDate(liveSince);
  const end = parseMyDate(todayMy);
  if (!start || !end || end < start) {
    return 0;
  }
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.floor((end.getTime() - start.getTime()) / msPerDay) + 1;
}

function parseMyDate(ymd: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
    return null;
  }
  return new Date(`${ymd}T12:00:00+08:00`);
}

export type CertificationEvidenceInput = {
  liveSince: string | null;
  liveWeeksRequired: number;
  usageLogCount: number;
  distinctPeople: number;
  distinctUsageDays: number;
  todayMy: string;
};

export type CertificationEvidenceResult = {
  daysLive: number;
  daysRequired: number;
  daysMet: boolean;
  logsMet: boolean;
  peopleMet: boolean;
  usageDaysMet: boolean;
  summary: string;
};

/**
 * Plain-language certification evidence for department Skills (Phase 2).
 * Two weeks means 14 calendar days in Malaysia from live_since.
 */
export function evaluateCertificationEvidence(input: CertificationEvidenceInput): CertificationEvidenceResult {
  const daysRequired = Math.max(1, input.liveWeeksRequired) * 7;
  const daysLive = input.liveSince ? calendarDaysLive(input.liveSince, input.todayMy) : 0;
  const daysMet = daysLive >= daysRequired;
  const logsMet = input.usageLogCount > 0;
  const peopleMet = input.distinctPeople > 0;
  const usageDaysMet = input.distinctUsageDays > 0;

  const parts = [
    `Live for ${daysLive} days, ${input.liveWeeksRequired} weeks required (${daysRequired} days): ${daysMet ? "met" : "not met"}.`,
    `Usage logs: ${input.usageLogCount}.`,
    `Distinct people: ${input.distinctPeople}.`,
    `Distinct days with use: ${input.distinctUsageDays}.`,
  ];

  return {
    daysLive,
    daysRequired,
    daysMet,
    logsMet,
    peopleMet,
    usageDaysMet,
    summary: parts.join(" "),
  };
}
