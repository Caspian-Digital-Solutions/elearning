import { describe, expect, it } from "vitest";
import {
  dueDateForProgrammeWeek,
  programmeWeekForDate,
  weekDateRange,
} from "@/lib/calendar/programme-week";

const week0 = "2027-01-11";
const cnyBreak = [{ startDate: "2027-02-08", weeks: 1, label: "Chinese New Year" }];

describe("programmeWeekForDate", () => {
  it("reports before start when cohort has not begun", () => {
    const state = programmeWeekForDate("2027-01-10T12:00:00+08:00", week0, []);
    expect(state.kind).toBe("before_start");
  });

  it("maps Week 0 Monday correctly", () => {
    const state = programmeWeekForDate("2027-01-11T09:00:00+08:00", week0, []);
    expect(state).toMatchObject({ kind: "week", programmeWeek: 0, weekMonday: "2027-01-11" });
  });

  it("shifts programme week across a break", () => {
    const withoutBreak = programmeWeekForDate("2027-02-15T12:00:00+08:00", week0, []);
    const withBreak = programmeWeekForDate("2027-02-15T12:00:00+08:00", week0, cnyBreak);
    expect(withoutBreak.kind).toBe("week");
    expect(withBreak.kind).toBe("week");
    if (withoutBreak.kind === "week" && withBreak.kind === "week") {
      expect(withBreak.programmeWeek).toBeLessThan(withoutBreak.programmeWeek);
    }
  });

  it("shows break label during a break week", () => {
    const state = programmeWeekForDate("2027-02-10T12:00:00+08:00", week0, cnyBreak);
    expect(state).toMatchObject({ kind: "break", label: "Chinese New Year" });
  });
});

describe("weekDateRange and due dates", () => {
  it("returns Monday–Friday for programme week 1", () => {
    const range = weekDateRange(1, week0, []);
    expect(range).toEqual({ monday: "2027-01-18", friday: "2027-01-22" });
  });

  it("due date is the Friday of the programme week", () => {
    expect(dueDateForProgrammeWeek(1, week0, [])).toBe("22 Jan 2027");
  });

  it("respects breaks when resolving week 5", () => {
    const plain = weekDateRange(5, week0, []);
    const shifted = weekDateRange(5, week0, cnyBreak);
    expect(plain?.monday).not.toBe(shifted?.monday);
  });
});

describe("Malaysia calendar day boundary", () => {
  it("uses Kuala Lumpur date for programme week lookup", () => {
    // Late evening UTC still same KL day as week0 Monday morning
    const state = programmeWeekForDate("2027-01-10T18:00:00.000Z", week0, []);
    expect(state.kind).toBe("week");
    if (state.kind === "week") {
      expect(state.programmeWeek).toBe(0);
    }
  });
});
