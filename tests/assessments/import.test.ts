import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  defaultWeek0SectionsFromSeed,
  parseAssessmentImportJson,
  validateAssessmentImport,
  type AssessmentImportFile,
} from "@/lib/assessments/import";

const week0Sections = {
  note: "test fixture",
  sections: defaultWeek0SectionsFromSeed().sections,
};

function validate(data: unknown, moduleCodes: string[] = ["f1", "f3"]) {
  return validateAssessmentImport(data, { week0Sections, moduleCodes });
}

const minimalPlacement = (): AssessmentImportFile => ({
  assessment: {
    code: "week0",
    title: "Test Week 0",
    type: "placement",
    instructions_md: "Instructions.",
    time_guide_min: 90,
    is_sample: true,
  },
  sections: week0Sections.sections.map((s) => ({
    code: s.code,
    title: s.name,
    max_score: s.max,
    counts_in_total: s.counts_in_total,
    instructions_md: "",
  })),
  rubrics: [
    {
      ref: "R-PROMPT",
      title: "Prompting",
      criteria: [
        {
          name: "Quality",
          max_score: 25,
          levels: [
            { score: 0, "descriptor": "Low" },
            { score: 25, descriptor: "High" },
          ],
        },
      ],
    },
    {
      ref: "R-DEPT",
      title: "Department",
      criteria: [
        {
          name: "Fit",
          max_score: 25,
          levels: [
            { score: 0, descriptor: "Low" },
            { score: 25, descriptor: "High" },
          ],
        },
      ],
    },
    {
      ref: "R-S5",
      title: "Safety text",
      criteria: [
        {
          name: "Safe",
          max_score: 5,
          levels: [
            { score: 0, descriptor: "Low" },
            { score: 5, descriptor: "High" },
          ],
        },
      ],
    },
    {
      ref: "R-W10",
      title: "Workflow",
      criteria: [
        {
          name: "Workflow",
          max_score: 10,
          levels: [
            { score: 0, descriptor: "Low" },
            { score: 10, descriptor: "High" },
          ],
        },
      ],
    },
  ],
  items: [
    {
      ref: "P1",
      section: "knowledge",
      type: "profile",
      domain: "C1",
      points: 0,
      prompt_md: "Profile?",
      options: [
        { id: "a", text: "A", points: 0 },
        { id: "b", text: "B", points: 0 },
      ],
    },
    {
      ref: "P2",
      section: "knowledge",
      type: "profile",
      domain: "C1",
      points: 0,
      prompt_md: "Profile 2?",
      options: [
        { id: "a", text: "A", points: 0 },
        { id: "b", text: "B", points: 0 },
      ],
    },
    {
      ref: "P3",
      section: "knowledge",
      type: "profile",
      domain: "C1",
      points: 0,
      prompt_md: "Profile 3?",
      options: [
        { id: "a", text: "A", points: 0 },
        { id: "b", text: "B", points: 0 },
      ],
    },
    ...[1, 2, 3, 4, 5].map((n) => ({
      ref: `K${n}`,
      section: "knowledge",
      type: "choice" as const,
      domain: "C1",
      difficulty: 1,
      points: 5,
      prompt_md: `Question ${n}`,
      options: [
        { id: "a", text: "Wrong", points: 0 },
        { id: "b", text: "Right", points: 5 },
      ],
    })),
    {
      ref: "PR1",
      section: "prompting",
      type: "practical",
      domain: "C2",
      difficulty: 2,
      points: 25,
      response_format: "prompt_and_output",
      rubric: "R-PROMPT",
      prompt_md: "Prompt task",
    },
    {
      ref: "DC",
      section: "department",
      type: "practical",
      department: "content",
      domain: "C2",
      difficulty: 2,
      points: 25,
      response_format: "prompt_and_output",
      rubric: "R-DEPT",
      prompt_md: "Content task",
    },
    {
      ref: "DR",
      section: "department",
      type: "practical",
      department: "creative",
      domain: "C2",
      difficulty: 2,
      points: 25,
      response_format: "prompt_and_output",
      rubric: "R-DEPT",
      prompt_md: "Creative task",
    },
    {
      ref: "DP",
      section: "department",
      type: "practical",
      department: "performance",
      domain: "C2",
      difficulty: 2,
      points: 25,
      response_format: "prompt_and_output",
      rubric: "R-DEPT",
      prompt_md: "Performance task",
    },
    {
      ref: "S1",
      section: "safety",
      type: "choice",
      domain: "C4",
      difficulty: 1,
      points: 5,
      prompt_md: "Safety 1",
      options: [
        { id: "a", text: "No", points: 0 },
        { id: "b", text: "Yes", points: 5 },
      ],
    },
    {
      ref: "S2",
      section: "safety",
      type: "choice",
      domain: "C4",
      difficulty: 1,
      points: 5,
      prompt_md: "Safety 2",
      options: [
        { id: "a", text: "No", points: 0 },
        { id: "b", text: "Yes", points: 5 },
      ],
    },
    {
      ref: "S3",
      section: "safety",
      type: "short_text",
      domain: "C4",
      difficulty: 2,
      points: 5,
      response_format: "text",
      rubric: "R-S5",
      prompt_md: "Safety text",
    },
    {
      ref: "W1",
      section: "workflow",
      type: "short_text",
      domain: "C9",
      difficulty: 2,
      points: 10,
      response_format: "text",
      rubric: "R-W10",
      prompt_md: "Workflow",
    },
    {
      ref: "T1",
      section: "technical",
      type: "choice",
      domain: "C7",
      difficulty: 3,
      points: 5,
      prompt_md: "Tech optional",
      options: [
        { id: "a", text: "A", points: 5 },
        { id: "b", text: "B", points: 0 },
      ],
    },
  ],
});

describe("assessment import validator", () => {
  it("accepts the repo SAMPLE Week 0 JSON", () => {
    const path = join(process.cwd(), "docs/content/samples/week0_sample.json");
    const parsed = parseAssessmentImportJson(readFileSync(path, "utf8"));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }
    const result = validate(parsed.data);
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it("accepts a minimal valid placement fixture", () => {
    const result = validate(minimalPlacement());
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("rejects invalid JSON", () => {
    const parsed = parseAssessmentImportJson("{");
    expect(parsed.ok).toBe(false);
  });

  it("rejects unknown domain codes", () => {
    const data = minimalPlacement();
    data.items[3].domain = "C99";
    const result = validate(data);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("domain"))).toBe(true);
  });

  it("rejects section point totals that do not match max_score", () => {
    const data = minimalPlacement();
    data.items[3].points = 4;
    const result = validate(data);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('Section "knowledge"'))).toBe(true);
  });

  it("rejects department section per-department totals", () => {
    const data = minimalPlacement();
    const dept = data.items.find((i) => i.ref === "DC");
    if (dept) {
      dept.points = 20;
    }
    const result = validate(data);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('"content"'))).toBe(true);
  });

  it("rejects choice items when best option points differ from item points", () => {
    const data = minimalPlacement();
    const choice = data.items.find((i) => i.ref === "K1");
    if (choice && choice.options) {
      choice.options[1].points = 3;
    }
    const result = validate(data);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("best option points"))).toBe(true);
  });

  it("rejects duplicate option ids", () => {
    const data = minimalPlacement();
    const choice = data.items.find((i) => i.ref === "K1");
    if (choice && choice.options) {
      choice.options[1].id = "a";
    }
    const result = validate(data);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('repeats option id "a"'))).toBe(true);
  });

  it("rejects rubric max not equal to item points", () => {
    const data = minimalPlacement();
    data.rubrics[0].criteria[0].max_score = 20;
    const result = validate(data);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("rubric") && e.includes("maximum"))).toBe(true);
  });

  it("rejects section max_score that disagrees with placement.week0_sections", () => {
    const data = minimalPlacement();
    const knowledge = data.sections.find((s) => s.code === "knowledge");
    if (knowledge) {
      knowledge.max_score = 24;
    }
    const result = validate(data);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("placement.week0_sections"))).toBe(true);
  });

  it("rejects unknown rubric refs on items", () => {
    const data = minimalPlacement();
    const pr = data.items.find((i) => i.ref === "PR1");
    if (pr) {
      pr.rubric = "R-MISSING";
    }
    const result = validate(data);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("R-MISSING"))).toBe(true);
  });

  it("rejects profile items with points", () => {
    const data = minimalPlacement();
    data.items[0].points = 1;
    const result = validate(data);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("Profile"))).toBe(true);
  });

  it("rejects a quiz without module_code", () => {
    const data = {
      assessment: {
        code: "quiz-x",
        title: "Quiz",
        type: "quiz",
        instructions_md: "Go",
        time_guide_min: 10,
        is_sample: true,
        pass_mark_pct: 80,
      },
      sections: [{ code: "check", title: "Check", max_score: null, counts_in_total: true }],
      rubrics: [],
      items: [
        {
          ref: "C1",
          section: "check",
          type: "choice",
          domain: "C1",
          difficulty: 1,
          points: 1,
          prompt_md: "Pick",
          options: [
            { id: "a", text: "A", points: 0 },
            { id: "b", text: "B", points: 1 },
          ],
        },
      ],
    };
    const result = validate(data);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("module_code"))).toBe(true);
  });

  it("rejects non-choice items in a quiz", () => {
    const data = {
      assessment: {
        code: "quiz-x",
        title: "Quiz",
        type: "quiz",
        module_code: "f1",
        instructions_md: "Go",
        time_guide_min: 10,
        is_sample: true,
        pass_mark_pct: 0,
      },
      sections: [{ code: "check", title: "Check", max_score: null, counts_in_total: true }],
      rubrics: [],
      items: [
        {
          ref: "P1",
          section: "check",
          type: "profile",
          domain: "C1",
          points: 0,
          prompt_md: "Profile",
          options: [
            { id: "a", text: "A", points: 0 },
            { id: "b", text: "B", points: 0 },
          ],
        },
      ],
    };
    const result = validate(data);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("type choice"))).toBe(true);
  });

  it("rejects practical items without a rubric", () => {
    const data = minimalPlacement();
    const pr = data.items.find((i) => i.ref === "PR1");
    if (pr) {
      delete pr.rubric;
    }
    const result = validate(data);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("needs a rubric"))).toBe(true);
  });
});
