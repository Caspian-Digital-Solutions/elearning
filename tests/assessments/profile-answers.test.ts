import { describe, expect, it } from "vitest";
import { extractProfileOptionIds, tallyProfileResponses } from "@/lib/assessments/profile-answers";

describe("profile answer counting", () => {
  it("counts each option in a multi-select answer", () => {
    const counts = tallyProfileResponses([
      {
        itemRef: "P01",
        answer: { option_ids: ["chatgpt", "claude"] },
        options: [
          { id: "chatgpt", text: "ChatGPT" },
          { id: "claude", text: "Claude" },
        ],
      },
      {
        itemRef: "P01",
        answer: { option_id: "chatgpt" },
        options: [{ id: "chatgpt", text: "ChatGPT" }],
      },
    ]);
    expect(counts.get("P01:ChatGPT")).toBe(2);
    expect(counts.get("P01:Claude")).toBe(1);
  });

  it("normalises legacy single option_id", () => {
    expect(extractProfileOptionIds({ option_id: "yes" })).toEqual(["yes"]);
  });
});
