import { describe, expect, it } from "vitest";
import { isModuleComplete } from "@/lib/plan/module-complete";

describe("isModuleComplete with assignments", () => {
  const lessons = [
    { id: "l1", status: "published" },
    { id: "l2", status: "published" },
  ];
  const progress = [{ lessonId: "l1" }, { lessonId: "l2" }];

  it("requires a passing released assignment when listed", () => {
    expect(
      isModuleComplete(lessons, progress, null, [
        { passMarkPct: 60, maxTotal: 20, releasedTotal: null },
      ]),
    ).toBe(false);
    expect(
      isModuleComplete(lessons, progress, null, [
        { passMarkPct: 60, maxTotal: 20, releasedTotal: 11 },
      ]),
    ).toBe(false);
    expect(
      isModuleComplete(lessons, progress, null, [
        { passMarkPct: 60, maxTotal: 20, releasedTotal: 12 },
      ]),
    ).toBe(true);
  });

  it("still requires lessons when assignments pass", () => {
    expect(
      isModuleComplete(lessons, [{ lessonId: "l1" }], null, [
        { passMarkPct: 60, maxTotal: 20, releasedTotal: 20 },
      ]),
    ).toBe(false);
  });
});
