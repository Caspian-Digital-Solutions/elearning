import { weekDateRange } from "@/lib/calendar/programme-week";
import type { CohortBreak } from "@/lib/calendar/types";
import type { PlanStatus } from "@/lib/plan/types";

export type OverduePlanRow = {
  status: PlanStatus;
  done: boolean;
  dueWeek: number | null;
};

function todayInKualaLumpur(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kuala_Lumpur",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** Whether a module is overdue (due Friday before today in Malaysia). */
export function isPlanRowOverdue(
  row: OverduePlanRow,
  week0StartDate: string,
  breaks: readonly CohortBreak[],
  todayKl: string = todayInKualaLumpur(),
): boolean {
  if (
    row.done ||
    (row.status !== "required" && row.status !== "bridge" && row.status !== "test_out_pending")
  ) {
    return false;
  }
  if (row.dueWeek === null) {
    return false;
  }
  const range = weekDateRange(row.dueWeek, week0StartDate, breaks);
  if (!range) {
    return false;
  }
  return range.friday < todayKl;
}

export function countOverdueModules(
  rows: readonly OverduePlanRow[],
  week0StartDate: string | null,
  breaks: readonly CohortBreak[] = [],
): number {
  if (!week0StartDate) {
    return 0;
  }
  const today = todayInKualaLumpur();
  return rows.filter((row) => isPlanRowOverdue(row, week0StartDate, breaks, today)).length;
}
