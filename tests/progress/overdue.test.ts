import { describe, expect, it } from "vitest";
import { countOverdueModules, isPlanRowOverdue } from "@/lib/progress/overdue";

const week0 = "2027-01-11";

describe("overdue at Malaysia due-date boundary", () => {
  it("is not overdue on the due Friday", () => {
    const row = { status: "required" as const, done: false, dueWeek: 1 };
    expect(isPlanRowOverdue(row, week0, [], "2027-01-22")).toBe(false);
  });

  it("is overdue from the Saturday after due Friday", () => {
    const row = { status: "required" as const, done: false, dueWeek: 1 };
    expect(isPlanRowOverdue(row, week0, [], "2027-01-23")).toBe(true);
  });

  it("counts overdue modules when due Friday is in the past", () => {
    const rows = [
      { status: "required" as const, done: false, dueWeek: 1 },
      { status: "tested_out" as const, done: true, dueWeek: 1 },
    ];
    expect(countOverdueModules(rows, "2020-01-06", [])).toBe(1);
  });
});
