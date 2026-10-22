import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  parseAssignmentImportJson,
  validateAssignmentImport,
} from "@/lib/assignments/import";

const moduleCodes = ["f4", "p1"];

describe("assignment import samples", () => {
  it("validates f4 and week5 SAMPLE files", () => {
    for (const name of ["f4_assignment_sample.json", "week5_testout_sample.json"]) {
      const text = readFileSync(join(process.cwd(), "docs/content/samples", name), "utf8");
      const parsed = parseAssignmentImportJson(text);
      expect(parsed.ok).toBe(true);
      if (!parsed.ok) {
        return;
      }
      const result = validateAssignmentImport(parsed.data, { moduleCodes });
      expect(result.ok).toBe(true);
      expect(result.errors).toEqual([]);
    }
  });
});

describe("assignment import validation errors", () => {
  it("rejects missing rubric ref", () => {
    const result = validateAssignmentImport(
      {
        assignments: [
          {
            code: "bad-one",
            title: "Bad",
            module_code: "f4",
            brief_md: "Brief",
            rubric_ref: "MISSING",
            submission_types: ["text"],
            pass_mark_pct: 60,
            is_test_out: false,
            is_sample: true,
          },
        ],
        rubrics: [],
      },
      { moduleCodes },
    );
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("MISSING"))).toBe(true);
  });

  it("rejects invalid pass mark", () => {
    const result = validateAssignmentImport(
      {
        assignments: [
          {
            code: "bad-pass",
            title: "Bad",
            module_code: "f4",
            brief_md: "Brief",
            rubric_ref: "R1",
            submission_types: ["text"],
            pass_mark_pct: 101,
            is_test_out: false,
            is_sample: true,
          },
        ],
        rubrics: [
          {
            ref: "R1",
            title: "Rubric",
            criteria: [
              {
                name: "A",
                max_score: 5,
                levels: [{ score: 0, descriptor: "Low" }, { score: 5, descriptor: "High" }],
              },
            ],
          },
        ],
      },
      { moduleCodes },
    );
    expect(result.ok).toBe(false);
  });
});
