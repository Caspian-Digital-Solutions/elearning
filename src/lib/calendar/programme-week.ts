import { formatCalendarDate, formatDate } from "@/lib/format";
import type { CohortBreak, ProgrammeWeekState } from "@/lib/calendar/types";

const KL_OFFSET = "+08:00";

function parseYmd(date: string): { y: number; m: number; d: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) {
    return null;
  }
  return { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) };
}

function addDaysYmd(ymd: string, days: number): string {
  const parsed = parseYmd(ymd);
  if (!parsed) {
    return ymd;
  }
  const utc = new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d + days));
  const y = utc.getUTCFullYear();
  const m = String(utc.getUTCMonth() + 1).padStart(2, "0");
  const d = String(utc.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function calendarDateInKl(isoOrDate: string | Date): string {
  const date = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kuala_Lumpur",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(date);
}

function mondayOfWeekContaining(ymd: string): string {
  const parsed = parseYmd(ymd);
  if (!parsed) {
    return ymd;
  }
  const date = new Date(`${ymd}T12:00:00${KL_OFFSET}`);
  const day = date.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  return addDaysYmd(ymd, diff);
}

function isDateInRange(ymd: string, start: string, endInclusive: string): boolean {
  return ymd >= start && ymd <= endInclusive;
}

function breakCalendarEnd(startMonday: string, weeks: number): string {
  const lastMonday = addDaysYmd(startMonday, (weeks - 1) * 7);
  return addDaysYmd(lastMonday, 6);
}

export function breakCoversDate(breaks: readonly CohortBreak[], ymd: string): CohortBreak | null {
  for (const breakRow of breaks) {
    const start = mondayOfWeekContaining(breakRow.startDate);
    const end = breakCalendarEnd(start, breakRow.weeks);
    if (isDateInRange(ymd, start, end)) {
      return breakRow;
    }
  }
  return null;
}

/** Programme week index and Mon–Fri range for a calendar date in Kuala Lumpur. */
export function programmeWeekForDate(
  date: string | Date,
  week0StartDate: string,
  breaks: readonly CohortBreak[] = [],
): ProgrammeWeekState {
  const ymd = calendarDateInKl(date);
  const anchor = mondayOfWeekContaining(week0StartDate);
  if (ymd < anchor) {
    return { kind: "before_start", week0StartDate };
  }

  const activeBreak = breakCoversDate(breaks, ymd);
  if (activeBreak) {
    return { kind: "break", label: activeBreak.label, breakStartDate: activeBreak.startDate };
  }

  let cursorMonday = anchor;
  let programmeWeek = 0;
  while (cursorMonday <= ymd) {
    const weekFriday = addDaysYmd(cursorMonday, 4);
    const coveringBreak = breakCoversDate(breaks, cursorMonday);
    if (!coveringBreak) {
      if (isDateInRange(ymd, cursorMonday, weekFriday)) {
        return { kind: "week", programmeWeek, weekMonday: cursorMonday, weekFriday };
      }
      programmeWeek += 1;
    }
    cursorMonday = addDaysYmd(cursorMonday, 7);
  }

  const lastMonday = mondayOfWeekContaining(ymd);
  return {
    kind: "week",
    programmeWeek,
    weekMonday: lastMonday,
    weekFriday: addDaysYmd(lastMonday, 4),
  };
}

export function weekDateRange(
  programmeWeek: number,
  week0StartDate: string,
  breaks: readonly CohortBreak[] = [],
): { monday: string; friday: string } | null {
  if (programmeWeek < 0) {
    return null;
  }
  let cursorMonday = mondayOfWeekContaining(week0StartDate);
  let index = 0;
  while (index <= programmeWeek) {
    if (!breakCoversDate(breaks, cursorMonday)) {
      if (index === programmeWeek) {
        return { monday: cursorMonday, friday: addDaysYmd(cursorMonday, 4) };
      }
      index += 1;
    }
    cursorMonday = addDaysYmd(cursorMonday, 7);
  }
  return null;
}

export function dueDateForProgrammeWeek(
  dueWeek: number,
  week0StartDate: string,
  breaks: readonly CohortBreak[] = [],
): string {
  const range = weekDateRange(dueWeek, week0StartDate, breaks);
  return range ? formatCalendarDate(range.friday) : "";
}

export function formatProgrammeWeekLine(
  date: string | Date,
  week0StartDate: string | null | undefined,
  breaks: readonly CohortBreak[] = [],
): string {
  if (!week0StartDate) {
    return "";
  }
  const state = programmeWeekForDate(date, week0StartDate, breaks);
  if (state.kind === "before_start") {
    return `Starts ${formatCalendarDate(state.week0StartDate)}`;
  }
  if (state.kind === "break") {
    return `Break: ${state.label}`;
  }
  return `Week ${state.programmeWeek}`;
}

export { formatDate };
