import { describe, expect, it } from "vitest";
import {
  f7Satisfied,
  isLogEditableNow,
  logEditableUntilMs,
  median,
  minuteDifference,
  visibleForGroup,
  week2LockEndMs,
} from "@/lib/timelog/stats";

describe("timelog stats", () => {
  it("computes median and difference", () => {
    expect(median([10, 30, 20])).toBe(20);
    expect(median([10, 20])).toBe(15);
    expect(minuteDifference(120, 45)).toBe(75);
    expect(minuteDifference(120, null)).toBeNull();
  });

  it("hides groups of 2 for managers but shows for trainers", () => {
    const manager = { minGroupSize: 3, viewerIsTrainerOrAdmin: false };
    const trainer = { minGroupSize: 3, viewerIsTrainerOrAdmin: true };
    expect(visibleForGroup(2, manager)).toBe(false);
    expect(visibleForGroup(3, manager)).toBe(true);
    expect(visibleForGroup(2, trainer)).toBe(true);
  });

  it("F7 requires distinct tasks", () => {
    expect(f7Satisfied(1, 2)).toBe(false);
    expect(f7Satisfied(2, 2)).toBe(true);
  });

  it("Week 2 lock ends Friday 23:59 Malaysia", () => {
    const end = week2LockEndMs("2026-10-16");
    expect(new Date(end).toISOString()).toContain("2026-10-16");
  });

  it("log edit window is seven Malaysia calendar days after creation day", () => {
    const created = "2026-10-01T04:00:00.000Z";
    const until = logEditableUntilMs(created);
    expect(isLogEditableNow(created, until - 1000)).toBe(true);
    expect(isLogEditableNow(created, until + 1000)).toBe(false);
  });
});
