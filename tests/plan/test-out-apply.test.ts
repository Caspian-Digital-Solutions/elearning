import { describe, expect, it } from "vitest";
import {
  applyTestOutFailToRows,
  applyTestOutPassToRows,
  testOutAttemptsRemaining,
} from "@/lib/plan/test-out-apply";

const week1Modules = ["F1", "F2", "F3", "F4", "F5", "F6"];

describe("applyTestOutPassToRows", () => {
  it("moves gated modules to tested_out with a dated reason", () => {
    const rows = week1Modules.map((code) => ({
      moduleCode: code,
      status: "test_out_pending" as const,
      dueWeek: 1,
      reason: "pending",
    }));
    const next = applyTestOutPassToRows(rows, week1Modules, 1, "21 Oct 2026");
    expect(next.every((row) => row.status === "tested_out")).toBe(true);
    expect(next[0]?.reason).toContain("Passed Week 1 test-out");
  });
});

describe("applyTestOutFailToRows", () => {
  it("restores Foundation due weeks when attempts are exhausted", () => {
    const rows = week1Modules.map((code) => ({
      moduleCode: code,
      status: "test_out_pending" as const,
      dueWeek: 1,
      reason: null,
    }));
    const ends: Record<string, number> = {
      F1: 2,
      F2: 2,
      F3: 2,
      F4: 3,
      F5: 3,
      F6: 3,
    };
    const next = applyTestOutFailToRows(rows, week1Modules, ends, 1, "21 Oct 2026");
    expect(next.find((row) => row.moduleCode === "F4")?.status).toBe("required");
    expect(next.find((row) => row.moduleCode === "F4")?.dueWeek).toBe(3);
    expect(next.find((row) => row.moduleCode === "F4")?.reason).toContain("not passed");
  });
});

describe("testOutAttemptsRemaining", () => {
  it("respects max_attempts", () => {
    expect(testOutAttemptsRemaining(0, 1)).toBe(true);
    expect(testOutAttemptsRemaining(1, 1)).toBe(false);
    expect(testOutAttemptsRemaining(2, null)).toBe(true);
  });
});
