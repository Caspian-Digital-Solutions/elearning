export type QuizAttemptOutcome = {
  percentage: number | null;
  passed: boolean | null;
  submittedAt: string | null;
};

/** Whether a percentage meets the pass threshold (inclusive). */
export function quizPassed(percentage: number, passMarkPct: number): boolean {
  return percentage >= passMarkPct;
}

/** Best attempt for display: highest percentage; ties favour a passing attempt. */
export function pickBestQuizAttempt<T extends QuizAttemptOutcome>(attempts: readonly T[]): T | null {
  const completed = attempts.filter((a) => a.submittedAt !== null && a.percentage !== null);
  if (completed.length === 0) {
    return null;
  }
  return completed.reduce((best, current) => {
    const bestPct = best.percentage ?? 0;
    const curPct = current.percentage ?? 0;
    if (curPct > bestPct) {
      return current;
    }
    if (curPct < bestPct) {
      return best;
    }
    if (current.passed && !best.passed) {
      return current;
    }
    return best;
  });
}

/** Random sample without replacement; deterministic when `random` is seeded. */
export function drawItemIds(pool: readonly string[], count: number, random: () => number): string[] {
  if (count <= 0 || pool.length === 0) {
    return [];
  }
  const take = Math.min(count, pool.length);
  const copy = [...pool];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, take);
}

export function countCompletedAttempts(
  attempts: readonly { status: string }[],
  completedStatuses: readonly string[] = ["submitted", "marking", "marked", "confirmed"],
): number {
  return attempts.filter((a) => completedStatuses.includes(a.status)).length;
}

export function attemptsRemaining(
  maxAttempts: number | null | undefined,
  completedCount: number,
): number | null {
  if (maxAttempts === null || maxAttempts === undefined) {
    return null;
  }
  return Math.max(0, maxAttempts - completedCount);
}

export function formatQuizScoreLabel(correct: number, total: number, percentage: number): string {
  return `${correct} of ${total} (${Math.round(percentage)}%)`;
}
