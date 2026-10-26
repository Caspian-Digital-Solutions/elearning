import { describe, expect, it } from "vitest";
import {
  calendarDaysLive,
  evaluateCertificationEvidence,
  malaysiaCalendarDate,
} from "@/lib/skills/certification-evidence";

describe("Malaysia live-use boundary", () => {
  it("counts inclusive calendar days between live_since and today", () => {
    expect(calendarDaysLive("2027-03-01", "2027-03-01")).toBe(1);
    expect(calendarDaysLive("2027-03-01", "2027-03-14")).toBe(14);
    expect(calendarDaysLive("2027-03-01", "2027-03-13")).toBe(13);
  });

  it("states whether two weeks of live use is met at the boundary", () => {
    const result = evaluateCertificationEvidence({
      liveSince: "2027-03-01",
      liveWeeksRequired: 2,
      usageLogCount: 5,
      distinctPeople: 3,
      distinctUsageDays: 4,
      todayMy: "2027-03-14",
    });
    expect(result.daysLive).toBe(14);
    expect(result.daysRequired).toBe(14);
    expect(result.daysMet).toBe(true);
    expect(result.summary).toContain("met");
  });

  it("uses Malaysia calendar date helper format", () => {
    const date = malaysiaCalendarDate(new Date("2027-03-14T15:30:00+08:00"));
    expect(date).toBe("2027-03-14");
  });
});
