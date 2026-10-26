import { describe, expect, it } from "vitest";
import {
  parseSkillFrontMatter,
  validateSkillDescription,
  validateSkillFrontMatter,
  validateSkillName,
} from "@/lib/skills/validators";

describe("skill name rules", () => {
  it("accepts lowercase hyphen names up to 64 characters", () => {
    expect(validateSkillName("brand-content-production")).toBeNull();
    expect(validateSkillName("a".repeat(64))).toBeNull();
  });

  it("refuses claude, anthropic and overlong names", () => {
    expect(validateSkillName("my-claude-skill")).toMatch(/claude/i);
    expect(validateSkillName("anthropic-helper")).toMatch(/anthropic/i);
    expect(validateSkillName("a".repeat(65))).toMatch(/64/);
    expect(validateSkillName("Bad Name")).toMatch(/lowercase/);
  });
});

describe("skill description", () => {
  it("refuses more than 1024 characters", () => {
    expect(validateSkillDescription("x".repeat(1024))).toBeNull();
    expect(validateSkillDescription("x".repeat(1025))).toMatch(/1024/);
  });
});

describe("front matter", () => {
  it("parses name and description from YAML front matter", () => {
    const text = `---
name: brand-content-production
description: Hello world
---
Body`;
    expect(parseSkillFrontMatter(text)).toEqual({
      name: "brand-content-production",
      description: "Hello world",
    });
  });

  it("requires front matter to match catalogue fields", () => {
    const text = `---
name: wrong-name
description: Hello
---
`;
    expect(
      validateSkillFrontMatter(text, { name: "brand-content-production", description: "Hello" }),
    ).toMatch(/catalogue name/);
    expect(
      validateSkillFrontMatter(`---
name: brand-content-production
description: Other
---`, { name: "brand-content-production", description: "Hello" }),
    ).toMatch(/description/);
  });
});
