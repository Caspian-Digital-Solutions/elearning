import { describe, expect, it } from "vitest";
import { klDateString, workingDaysWaiting } from "@/lib/assignments/working-days";

describe("workingDaysWaiting", () => {
  it("returns 0 on the same Malaysia calendar day", () => {
    const submitted = new Date("2026-10-20T08:00:00+08:00");
    const asOf = new Date("2026-10-20T22:00:00+08:00");
    expect(klDateString(submitted)).toBe("2026-10-20");
    expect(workingDaysWaiting(submitted, asOf)).toBe(0);
  });

  it("counts Monday–Friday only", () => {
    const friday = new Date("2026-10-16T10:00:00+08:00");
    const monday = new Date("2026-10-19T10:00:00+08:00");
    expect(workingDaysWaiting(friday, monday)).toBe(1);
  });

  it("counts consecutive weekdays across a week", () => {
    const monday = new Date("2026-10-19T09:00:00+08:00");
    const wednesday = new Date("2026-10-21T18:00:00+08:00");
    expect(workingDaysWaiting(monday, wednesday)).toBe(2);
  });
});
