import { describe, expect, it } from "vitest";
import { medianWorkingDays } from "@/lib/progress/working-days-median";

describe("medianWorkingDays", () => {
  it("returns the middle value for an odd count", () => {
    expect(medianWorkingDays([4, 2, 6])).toBe(4);
  });

  it("averages the two middle values for an even count", () => {
    expect(medianWorkingDays([2, 4, 6, 8])).toBe(5);
  });

  it("returns null for an empty list", () => {
    expect(medianWorkingDays([])).toBeNull();
  });
});
