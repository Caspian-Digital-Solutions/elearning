import { describe, expect, it } from "vitest";
import { helpPageUpdatedLabel } from "@/lib/content/help-footer";

describe("helpPageUpdatedLabel", () => {
  it("shows not yet published when there is no date", () => {
    expect(helpPageUpdatedLabel(null)).toBe("Not yet published");
    expect(helpPageUpdatedLabel(undefined)).toBe("Not yet published");
  });

  it("shows updated date when published", () => {
    expect(helpPageUpdatedLabel("2026-10-22T08:00:00.000Z")).toMatch(/^Updated \d+ \w+ 2026$/);
  });
});
