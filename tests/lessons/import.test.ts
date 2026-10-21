import { describe, expect, it } from "vitest";
import {
  findImageRefs,
  parseLessonMarkdown,
  previewRow,
  validateLessonImport,
} from "@/lib/lessons/import";

const modules = { F4: "mod-f4" };
const departments = { content: "dep-content", creative: "dep-creative" };

const validBody = `---
module: F4
title: Anatomy of a prompt
slug: anatomy-of-a-prompt
kind: lesson
duration_min: 12
departments: all
order: 2
summary: Short summary.
---

Body text here.
`;

describe("lesson import", () => {
  it("parses valid front matter", () => {
    const parsed = parseLessonMarkdown("file.md", validBody);
    expect(parsed.moduleCode).toBe("F4");
    expect(parsed.slug).toBe("anatomy-of-a-prompt");
    expect(parsed.durationMin).toBe(12);
    expect(parsed.bodyMd).toContain("Body text");
  });

  it("rejects unknown module", () => {
    const parsed = parseLessonMarkdown(
      "file.md",
      validBody.replace("module: F4", "module: F99"),
    );
    const errors = validateLessonImport(parsed, modules, departments);
    expect(errors.some((e) => e.includes("F99"))).toBe(true);
  });

  it("rejects bad duration", () => {
    const parsed = parseLessonMarkdown("file.md", validBody.replace("duration_min: 12", "duration_min: 90"));
    const errors = validateLessonImport(parsed, modules, departments);
    expect(errors).toContain("Duration must be 1–60.");
  });

  it("rejects disallowed video host", () => {
    const parsed = parseLessonMarkdown(
      "file.md",
      `${validBody.replace("---\n\nBody", "video: https://example.com/x\n---\n\nBody")}`,
    );
    const errors = validateLessonImport(parsed, modules, departments);
    expect(errors).toContain("Video host not allowed.");
  });

  it("flags image references", () => {
    const parsed = parseLessonMarkdown("file.md", `${validBody}\n\n![alt](https://x/y.png)`);
    expect(findImageRefs(parsed.bodyMd).length).toBe(1);
    const errors = validateLessonImport(parsed, modules, departments);
    expect(errors.some((e) => e.includes("Image references"))).toBe(true);
  });

  it("preview marks ready rows", () => {
    const parsed = parseLessonMarkdown("file.md", validBody);
    const row = previewRow(parsed, modules, departments, false);
    expect(row.ready).toBe(true);
    expect(row.result).toBe("Ready");
  });

  it("preview notes duplicate slug", () => {
    const parsed = parseLessonMarkdown("file.md", validBody);
    const row = previewRow(parsed, modules, departments, true);
    expect(row.duplicateNote).toContain("existing lesson");
  });
});
