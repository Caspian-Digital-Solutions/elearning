import { describe, expect, it } from "vitest";
import { fillPromptBody, parsePlaceholders } from "@/lib/prompts/placeholders";

describe("prompt placeholders", () => {
  it("parses unique names in order", () => {
    expect(parsePlaceholders("Hi {{client_brief}} and {{client_brief}} {{tone}}")).toEqual([
      "client_brief",
      "tone",
    ]);
  });

  it("fills placeholders client-side", () => {
    const body = "Write for {{client_brief}} in {{tone}}.";
    expect(fillPromptBody(body, { client_brief: "Acme", tone: "friendly" })).toBe(
      "Write for Acme in friendly.",
    );
  });
});
