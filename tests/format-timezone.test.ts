import { describe, expect, it } from "vitest";
import { formatDate, formatDateTime } from "@/lib/format";

describe("Malaysia timezone formatting", () => {
  it("shows the next calendar day when UTC is still the previous day", () => {
    // 2026-10-20 15:30 UTC = 2026-10-20 23:30 in Kuala Lumpur (same calendar day)
    expect(formatDate("2026-10-20T15:30:00.000Z")).toBe("20 Oct 2026");
    expect(formatDateTime("2026-10-20T15:30:00.000Z")).toBe("20 Oct 2026, 23:30");
  });

  it("crosses midnight in Kuala Lumpur before UTC rolls to the next day", () => {
    // 2026-10-20 16:05 UTC = 2026-10-21 00:05 in Kuala Lumpur
    expect(formatDate("2026-10-20T16:05:00.000Z")).toBe("21 Oct 2026");
    expect(formatDateTime("2026-10-20T16:05:00.000Z")).toBe("21 Oct 2026, 00:05");
  });
});
