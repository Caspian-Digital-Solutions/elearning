import { describe, expect, it } from "vitest";
import { countAcknowledged, formatAcknowledgementCount } from "@/lib/content/acknowledgements";

describe("acknowledgement counts", () => {
  it("formats N of M", () => {
    expect(formatAcknowledgementCount(2, 10)).toBe("2 of 10 active people");
  });

  it("counts only active people who acknowledged", () => {
    const active = new Set(["a", "b", "c"]);
    expect(countAcknowledged([{ user_id: "a" }, { user_id: "x" }], active)).toBe(1);
  });
});
