import { describe, expect, it } from "vitest";
import { calloutLabel, splitCallouts } from "@/lib/content/callouts";

describe("callouts", () => {
  it("labels each kind with a word", () => {
    expect(calloutLabel("WARNING")).toBe("Warning");
  });

  it("splits a warning callout block", () => {
    const md = "> [!WARNING]\n> Careful with client data.";
    const parts = splitCallouts(md);
    expect(parts).toHaveLength(1);
    expect(parts[0].type).toBe("callout");
    if (parts[0].type === "callout") {
      expect(parts[0].callout.kind).toBe("WARNING");
      expect(parts[0].callout.body).toContain("Careful");
    }
  });
});
