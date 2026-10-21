import type { PlanStatus } from "@/lib/plan/types";

export type TestOutPlanRow = {
  moduleCode: string;
  status: PlanStatus;
  dueWeek: number | null;
  reason: string | null;
};

/** Pure mirror of apply_test_out_result pass branch (assessment path). */
export function applyTestOutPassToRows(
  rows: TestOutPlanRow[],
  testOutModules: readonly string[],
  week: number,
  resultDateLabel: string,
): TestOutPlanRow[] {
  const targets = new Set(testOutModules.map((code) => code.toUpperCase()));
  const reason = `Passed Week ${week} test-out on ${resultDateLabel}`;
  return rows.map((row) =>
    targets.has(row.moduleCode.toUpperCase())
      ? { ...row, status: "tested_out", dueWeek: null, reason }
      : row,
  );
}

/** Pure mirror of apply_test_out_result fail branch when attempts are exhausted. */
export function applyTestOutFailToRows(
  rows: TestOutPlanRow[],
  testOutModules: readonly string[],
  moduleWeekEndByCode: Readonly<Record<string, number>>,
  week: number,
  resultDateLabel: string,
): TestOutPlanRow[] {
  const targets = new Set(testOutModules.map((code) => code.toUpperCase()));
  const reason = `Week ${week} test-out not passed on ${resultDateLabel}`;
  return rows.map((row) => {
    if (!targets.has(row.moduleCode.toUpperCase())) {
      return row;
    }
    const dueWeek = moduleWeekEndByCode[row.moduleCode] ?? moduleWeekEndByCode[row.moduleCode.toUpperCase()] ?? null;
    return { ...row, status: "required", dueWeek, reason };
  });
}

/** Whether a learner still has attempts left on a capped assessment. */
export function testOutAttemptsRemaining(
  attemptsUsed: number,
  maxAttempts: number | null | undefined,
): boolean {
  if (maxAttempts === null || maxAttempts === undefined) {
    return true;
  }
  return attemptsUsed < maxAttempts;
}
