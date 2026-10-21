import { describe, expect, it } from "vitest";
import { isModuleComplete, moduleQuizOutcomeLabel } from "@/lib/plan/module-complete";

describe("isModuleComplete", () => {
  const lessons = [
    { id: "l1", status: "published" },
    { id: "l2", status: "published" },
  ];

  it("requires every published lesson", () => {
    expect(
      isModuleComplete(lessons, [{ lessonId: "l1" }], null),
    ).toBe(false);
    expect(
      isModuleComplete(lessons, [{ lessonId: "l1" }, { lessonId: "l2" }], null),
    ).toBe(true);
  });

  it("treats pass-mark zero quiz as complete after submit", () => {
    expect(
      isModuleComplete(lessons, [{ lessonId: "l1" }, { lessonId: "l2" }], {
        passMarkPct: 0,
        itemsPerAttempt: 5,
        questionCount: 5,
        bestPercentage: 40,
        hasSubmittedAttempt: true,
      }),
    ).toBe(true);
  });

  it("requires a passing score when pass mark is set", () => {
    expect(
      isModuleComplete(lessons, [{ lessonId: "l1" }, { lessonId: "l2" }], {
        passMarkPct: 80,
        itemsPerAttempt: 10,
        questionCount: 10,
        bestPercentage: 70,
        hasSubmittedAttempt: true,
      }),
    ).toBe(false);
    expect(
      isModuleComplete(lessons, [{ lessonId: "l1" }, { lessonId: "l2" }], {
        passMarkPct: 80,
        itemsPerAttempt: 10,
        questionCount: 10,
        bestPercentage: 80,
        hasSubmittedAttempt: true,
      }),
    ).toBe(true);
  });
});

describe("moduleQuizOutcomeLabel", () => {
  it("uses Completed wording when there is no pass mark", () => {
    const label = moduleQuizOutcomeLabel({
      passMarkPct: 0,
      itemsPerAttempt: 5,
      questionCount: 5,
      bestPercentage: 40,
      hasSubmittedAttempt: true,
    });
    expect(label).toBe("Completed — 2 of 5 (40%)");
  });
});
