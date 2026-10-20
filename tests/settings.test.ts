import { describe, expect, it } from "vitest";
import { changedFields } from "@/lib/audit/diff";
import { summariseSetting } from "@/lib/settings/describe";
import {
  checkBands,
  checkDepartmentCertification,
  checkFoundationCertification,
  checkGates,
  checkReason,
  checkSetting,
  checkWeek0Sections,
  parseJsonText,
} from "@/lib/settings/validators";

// Shaped like the seeded values; the tests never rely on the numbers in code.
const sections = {
  note: "PROPOSED",
  sections: [
    { code: "knowledge", name: "Knowledge", max: 25, counts_in_total: true },
    { code: "prompting", name: "Prompting", max: 25, counts_in_total: true },
    { code: "department", name: "Department task", max: 25, counts_in_total: true },
    { code: "safety", name: "Safety and judgement", max: 15, counts_in_total: true },
    { code: "workflow", name: "Workflow", max: 10, counts_in_total: true },
    { code: "technical", name: "Technical supplement (optional)", max: null, counts_in_total: false },
  ],
};

const band = (min: number, max: number, stream: string, extra: Record<string, unknown> = {}) => ({
  min,
  max,
  stream,
  ...extra,
});

const cleanBands = {
  note: "PROPOSED DL-003",
  bands: [
    band(0, 44, "foundation"),
    band(45, 69, "practitioner", { bridges_for_domains_below_pct: 60 }),
    band(70, 84, "practitioner_fast_track"),
    band(85, 100, "champion", { requires: "portfolio review confirmed by trainer" }),
  ],
};

function errorsOf(result: { ok: boolean; errors?: string[] }) {
  return result.ok ? [] : (result as { errors: string[] }).errors;
}

describe("placement bands", () => {
  it("passes 0–44, 45–69, 70–84, 85–100 and keeps extra fields", () => {
    const result = checkBands(cleanBands);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.bands[3]).toMatchObject({ requires: "portfolio review confirmed by trainer" });
      expect(result.value.note).toBe("PROPOSED DL-003");
    }
  });

  it("passes when the bands are listed out of order", () => {
    expect(checkBands({ bands: [...cleanBands.bands].reverse() }).ok).toBe(true);
  });

  it("fails a gap at 44/46", () => {
    const result = checkBands({
      bands: [band(0, 44, "foundation"), band(46, 69, "practitioner"), band(70, 100, "champion")],
    });
    expect(errorsOf(result)).toEqual(["There is a gap between 44 and 46: scores 45 to 45 have no band."]);
  });

  it("fails an overlap", () => {
    const result = checkBands({
      bands: [band(0, 45, "foundation"), band(45, 69, "practitioner"), band(70, 100, "champion")],
    });
    expect(errorsOf(result)).toEqual(["The bands 0 to 45 and 45 to 69 overlap."]);
  });

  it("fails when the bands do not start at 0 or end at 100", () => {
    expect(errorsOf(checkBands({ bands: [band(1, 100, "foundation")] }))).toEqual([
      "The bands must start at 0. The lowest band starts at 1.",
    ]);
    expect(errorsOf(checkBands({ bands: [band(0, 99, "foundation")] }))).toEqual([
      "The bands must end at 100. The highest band ends at 99.",
    ]);
  });

  it("fails a band whose minimum is above its maximum", () => {
    const result = checkBands({ bands: [band(0, 50, "foundation"), band(60, 51, "practitioner"), band(61, 100, "champion")] });
    expect(errorsOf(result)).toContain("The band 60 to 51 has a minimum above its maximum.");
  });

  it("fails a stream that is not on the allowed list", () => {
    const result = checkBands({ bands: [band(0, 100, "expert")] });
    expect(errorsOf(result)[0]).toMatch(/^Each band's stream must be one of: Foundation, Practitioner/);
  });

  it("fails fractions and missing numbers", () => {
    expect(errorsOf(checkBands({ bands: [band(0, 44.5, "foundation")] }))).toEqual([
      "A band's maximum must be a whole number.",
    ]);
    expect(checkBands({ bands: [] }).ok).toBe(false);
    expect(checkBands({}).ok).toBe(false);
  });
});

describe("placement gates", () => {
  const gates = { note: "PROPOSED DL-002", safety_min_else_foundation: 9, prompting_min_for_practitioner: 15 };

  it("passes gates within the section maxima, including 0 and the maximum itself", () => {
    expect(checkGates(gates, sections).ok).toBe(true);
    expect(checkGates({ safety_min_else_foundation: 0, prompting_min_for_practitioner: 0 }, sections).ok).toBe(true);
    expect(checkGates({ safety_min_else_foundation: 15, prompting_min_for_practitioner: 25 }, sections).ok).toBe(true);
  });

  it("fails a Safety gate above the Safety maximum or below 0", () => {
    expect(errorsOf(checkGates({ ...gates, safety_min_else_foundation: 16 }, sections))).toEqual([
      "The Safety gate must be between 0 and the Safety section maximum (15).",
    ]);
    expect(checkGates({ ...gates, safety_min_else_foundation: -1 }, sections).ok).toBe(false);
  });

  it("fails a Prompting gate above the Prompting maximum", () => {
    expect(errorsOf(checkGates({ ...gates, prompting_min_for_practitioner: 26 }, sections))).toEqual([
      "The Prompting gate must be between 0 and the Prompting section maximum (25).",
    ]);
  });

  it("fails a gate that is not a whole number", () => {
    expect(errorsOf(checkGates({ ...gates, safety_min_else_foundation: 8.5 }, sections))).toEqual([
      "The Safety gate must be a whole number.",
    ]);
  });

  it("follows the section maxima it is given, not fixed numbers", () => {
    const smaller = { sections: sections.sections.map((s) => (s.code === "safety" ? { ...s, max: 8 } : s)) };
    expect(checkGates(gates, smaller).ok).toBe(false);
  });
});

describe("Week-0 sections", () => {
  it("passes when the counted sections add up to 100", () => {
    expect(checkWeek0Sections(sections).ok).toBe(true);
  });

  it("fails when the counted sections add up to 99 or 101", () => {
    const at = (workflow: number) => ({
      sections: sections.sections.map((s) => (s.code === "workflow" ? { ...s, max: workflow } : s)),
    });
    expect(errorsOf(checkWeek0Sections(at(9)))).toEqual([
      "The sections that count in the total must add up to 100. They add up to 99.",
    ]);
    expect(checkWeek0Sections(at(11)).ok).toBe(false);
  });

  it("ignores sections that do not count in the total", () => {
    const withBigOptional = {
      sections: sections.sections.map((s) => (s.code === "technical" ? { ...s, max: 40 } : s)),
    };
    expect(checkWeek0Sections(withBigOptional).ok).toBe(true);
  });

  it("fails a counted section with no maximum, and repeated codes", () => {
    const noMax = { sections: sections.sections.map((s) => (s.code === "workflow" ? { ...s, max: null } : s)) };
    expect(errorsOf(checkWeek0Sections(noMax))).toContain("Workflow counts in the total, so it needs a maximum.");
    const repeated = { sections: [...sections.sections, { ...sections.sections[5] }] };
    expect(errorsOf(checkWeek0Sections(repeated))).toContain("Each section code must be used once.");
  });

  it("fails a new Safety maximum below the saved Safety gate", () => {
    const moved = {
      sections: sections.sections.map((s) =>
        s.code === "safety" ? { ...s, max: 8 } : s.code === "workflow" ? { ...s, max: 17 } : s,
      ),
    };
    const gates = { safety_min_else_foundation: 9, prompting_min_for_practitioner: 15 };
    expect(errorsOf(checkWeek0Sections(moved, gates))).toEqual([
      "The Safety gate must be between 0 and the Safety section maximum (8). Change the placement gates first.",
    ]);
  });
});

describe("certification", () => {
  it("foundation percentages must be whole numbers from 0 to 100", () => {
    const valid = { overall_min_pct: 70, safety_quiz_pass_pct: 80, safety_quiz_must_pass: true };
    expect(checkFoundationCertification(valid).ok).toBe(true);
    expect(checkFoundationCertification({ ...valid, overall_min_pct: 0 }).ok).toBe(true);
    expect(checkFoundationCertification({ ...valid, overall_min_pct: 100 }).ok).toBe(true);
    expect(errorsOf(checkFoundationCertification({ ...valid, overall_min_pct: 101 }))).toEqual([
      "The overall minimum must be between 0 and 100.",
    ]);
    expect(checkFoundationCertification({ ...valid, safety_quiz_pass_pct: -1 }).ok).toBe(false);
    expect(checkFoundationCertification({ ...valid, safety_quiz_must_pass: "yes" }).ok).toBe(false);
  });

  it("department weeks of live use must be 1 to 12", () => {
    expect(checkDepartmentCertification({ live_use_weeks_required: 1 }).ok).toBe(true);
    expect(checkDepartmentCertification({ live_use_weeks_required: 12 }).ok).toBe(true);
    expect(errorsOf(checkDepartmentCertification({ live_use_weeks_required: 0 }))).toEqual([
      "Weeks of live use must be between 1 and 12.",
    ]);
    expect(checkDepartmentCertification({ live_use_weeks_required: 13 }).ok).toBe(false);
  });
});

describe("any setting", () => {
  it("checks a known key with its own rules and the other saved settings", () => {
    const current = { "placement.week0_sections": sections };
    expect(checkSetting("placement.gates", { safety_min_else_foundation: 99, prompting_min_for_practitioner: 1 }, current).ok).toBe(false);
    expect(checkSetting("placement.bands", cleanBands, current).ok).toBe(true);
  });

  it("accepts any JSON for an unknown key, and the JSON editor refuses invalid JSON", () => {
    expect(checkSetting("other.key", { anything: [1, 2] }, {}).ok).toBe(true);
    expect(parseJsonText('{"a": 1}')).toEqual({ ok: true, value: { a: 1 } });
    expect(parseJsonText("{a: 1}").ok).toBe(false);
    expect(parseJsonText("   ").ok).toBe(false);
  });

  it("needs a reason of 10 to 500 characters", () => {
    expect(checkReason("too short").ok).toBe(false);
    expect(checkReason("   padded   ").ok).toBe(false);
    expect(checkReason("Agreed at the trainers' meeting")).toEqual({ ok: true, value: "Agreed at the trainers' meeting" });
    expect(checkReason("x".repeat(501)).ok).toBe(false);
  });

  it("summarises values in plain words", () => {
    expect(summariseSetting("placement.bands", cleanBands)).toBe(
      "0–44 Foundation; 45–69 Practitioner; 70–84 Practitioner fast track; 85–100 Champion",
    );
    expect(summariseSetting("certification.department", { live_use_weeks_required: 2 })).toBe("2 weeks of live use");
  });
});

describe("changed fields", () => {
  it("lists only what changed, nested values included", () => {
    const after = { ...cleanBands, bands: cleanBands.bands.map((b, i) => (i === 1 ? { ...b, max: 70 } : b)) };
    expect(changedFields({ value: cleanBands }, { value: after })).toEqual([
      { field: "value.bands[2].max", before: "69", after: "70" },
    ]);
  });

  it("ignores bookkeeping fields and shows empty values in words", () => {
    expect(
      changedFields(
        { department_id: null, updated_at: "a", last_seen_at: "b", is_active: true },
        { department_id: "d1", updated_at: "c", last_seen_at: "d", is_active: false },
      ),
    ).toEqual([
      { field: "department_id", before: "empty", after: "d1" },
      { field: "is_active", before: "yes", after: "no" },
    ]);
  });
});
