import { describe, expect, it } from "vitest";
import { z } from "zod";

const copySchema = z.object({
  promptId: z.string().uuid(),
  promptVersion: z.coerce.number().int().positive(),
});

const feedbackSchema = z.object({
  promptId: z.string().uuid(),
  promptVersion: z.coerce.number().int().positive(),
  outcome: z.enum(["worked", "needed_edits", "did_not_work"]),
  comment: z.string().max(500).optional(),
  declaration: z.literal(true),
});

describe("prompt server action payloads", () => {
  it("copy action never includes filled prompt text", () => {
    const payload = copySchema.parse({
      promptId: "00000000-0000-4000-8000-000000000001",
      promptVersion: 2,
    });
    expect(Object.keys(payload).sort()).toEqual(["promptId", "promptVersion"]);
  });

  it("feedback action never includes filled prompt text", () => {
    const payload = feedbackSchema.parse({
      promptId: "00000000-0000-4000-8000-000000000001",
      promptVersion: 2,
      outcome: "worked",
      comment: "Helpful structure",
      declaration: true,
    });
    expect(Object.keys(payload).sort()).toEqual(["comment", "declaration", "outcome", "promptId", "promptVersion"]);
  });
});
