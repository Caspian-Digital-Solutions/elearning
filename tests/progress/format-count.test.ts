import { describe, expect, it } from "vitest";
import { formatCount } from "@/lib/progress/format-count";

describe("formatCount", () => {
  it('formats as "7 of 16"', () => {
    expect(formatCount(7, 16)).toBe("7 of 16");
  });

  it("handles zero totals", () => {
    expect(formatCount(0, 0)).toBe("0 of 0");
  });
});
