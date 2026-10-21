import { describe, expect, it } from "vitest";
import {
  attemptsRemaining,
  drawItemIds,
  pickBestQuizAttempt,
  quizPassed,
} from "@/lib/assessments/quiz-status";

describe("quizPassed", () => {
  it("fails at 79% when pass mark is 80", () => {
    expect(quizPassed(79, 80)).toBe(false);
  });

  it("passes at 80% when pass mark is 80", () => {
    expect(quizPassed(80, 80)).toBe(true);
  });
});

describe("pickBestQuizAttempt", () => {
  it("picks the highest percentage", () => {
    const best = pickBestQuizAttempt([
      { percentage: 60, passed: false, submittedAt: "2026-01-01" },
      { percentage: 85, passed: true, submittedAt: "2026-01-02" },
      { percentage: 70, passed: false, submittedAt: "2026-01-03" },
    ]);
    expect(best?.percentage).toBe(85);
  });
});

describe("drawItemIds", () => {
  it("returns the requested count with no duplicates", () => {
    const pool = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l"];
    let seed = 0;
    const random = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    const drawn = drawItemIds(pool, 10, random);
    expect(drawn).toHaveLength(10);
    expect(new Set(drawn).size).toBe(10);
    for (const id of drawn) {
      expect(pool).toContain(id);
    }
  });
});

describe("attemptsRemaining", () => {
  it("returns null for unlimited quizzes", () => {
    expect(attemptsRemaining(null, 2)).toBeNull();
  });

  it("subtracts completed attempts", () => {
    expect(attemptsRemaining(3, 2)).toBe(1);
  });
});
