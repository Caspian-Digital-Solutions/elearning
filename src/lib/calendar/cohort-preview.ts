import { formatCalendarDate } from "@/lib/format";
import { weekDateRange } from "@/lib/calendar/programme-week";
import type { CohortBreak } from "@/lib/calendar/types";

export type CohortCalendarWeekRow = {
  programmeWeek: number;
  monday: string;
  friday: string;
  label: string;
};

/** Weeks 0–12 with Monday–Friday dates for a cohort editor preview. */
export function buildCohortCalendarPreview(
  week0StartDate: string,
  breaks: readonly CohortBreak[],
  maxWeek = 12,
): CohortCalendarWeekRow[] {
  const rows: CohortCalendarWeekRow[] = [];
  for (let week = 0; week <= maxWeek; week += 1) {
    const range = weekDateRange(week, week0StartDate, breaks);
    if (!range) {
      continue;
    }
    const breakAtStart = breaks.find((row) => {
      const start = row.startDate;
      return start <= range.monday && range.monday <= addDays(start, row.weeks * 7 - 1);
    });
    rows.push({
      programmeWeek: week,
      monday: formatCalendarDate(range.monday),
      friday: formatCalendarDate(range.friday),
      label: breakAtStart ? `Break: ${breakAtStart.label}` : week === 0 ? "Week 0" : `Week ${week}`,
    });
  }
  return rows;
}

function addDays(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d + days));
  const yy = utc.getUTCFullYear();
  const mm = String(utc.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(utc.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export function isMondayDate(ymd: string): boolean {
  const [y, m, d] = ymd.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCDay() === 1;
}
