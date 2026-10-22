import { describe, expect, it } from "vitest";
import { progressTabUserMessage } from "@/lib/progress/load-section-messages";
import { loadProgressSection } from "@/lib/progress/load-section";

describe("loadProgressSection", () => {
  it("returns a plain-English message when a tab loader throws", async () => {
    const result = await loadProgressSection("modules", async () => {
      throw new Error("Could not load module progress.");
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toBe(progressTabUserMessage("modules"));
      expect(result.message).toMatch(/module summary/i);
    }
  });

  it("returns data when the loader succeeds", async () => {
    const result = await loadProgressSection("modules", async () => [{ module_code: "F1" }]);
    expect(result).toEqual({ ok: true, data: [{ module_code: "F1" }] });
  });
});
