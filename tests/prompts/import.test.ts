import { describe, expect, it } from "vitest";
import { parsePromptImportJson, validatePromptImport } from "@/lib/prompts/import-validator";

const options = {
  taskTypes: ["drafting", "research"],
  departmentCodes: ["content"],
  moduleCodes: ["f1"],
};

describe("prompt import validator", () => {
  it("rejects invalid slug and tool", () => {
    const parsed = parsePromptImportJson(
      JSON.stringify({
        prompts: [
          {
            title: "Bad",
            slug: "Bad Slug",
            task_type: "drafting",
            tool: "bing",
            risk_tier: "low",
            body: "Hello {{topic}}",
          },
        ],
      }),
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }
    const result = validatePromptImport(parsed.data, options);
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.errors.join(" ")).toMatch(/slug/i);
    expect(result.errors.join(" ")).toMatch(/tool/i);
  });

  it("accepts a valid prompt", () => {
    const parsed = parsePromptImportJson(
      JSON.stringify({
        prompts: [
          {
            title: "SAMPLE Draft email",
            slug: "sample-draft-email",
            task_type: "drafting",
            tool: "claude",
            risk_tier: "medium",
            body: "Draft for {{client_brief}}",
            department_code: "content",
            module_code: "f1",
          },
        ],
      }),
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }
    const result = validatePromptImport(parsed.data, options);
    expect(result.ok).toBe(true);
  });
});
