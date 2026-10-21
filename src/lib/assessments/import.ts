import { checkWeek0Sections, type Week0Sections } from "@/lib/settings/validators";

export const assessmentTypes = ["placement", "quiz", "safety_quiz", "capstone"] as const;
export type AssessmentType = (typeof assessmentTypes)[number];

export const itemTypes = ["profile", "choice", "short_text", "practical"] as const;
export type ItemType = (typeof itemTypes)[number];

export const responseFormats = ["text", "prompt_and_output", "link"] as const;
export type ResponseFormat = (typeof responseFormats)[number];

/** Competency domain codes from `docs/seed/curriculum_v1_1.json`. */
export const importDomainCodes = [
  "C1",
  "C2",
  "C3",
  "C4",
  "C5",
  "C6",
  "C7",
  "C8",
  "C9",
] as const;

/** Active department codes (same set as lesson import). */
export const importDepartmentCodes = [
  "content",
  "creative",
  "performance",
  "performance-seo",
  "performance-paid",
  "performance-analytics",
  "account-management",
  "senior-management",
] as const;

/** Parent departments that receive their own Week 0 department-section task. */
export const departmentSectionDepartmentCodes = ["content", "creative", "performance"] as const;

const itemRefRe = /^[A-Z0-9][A-Z0-9_-]*$/;
const assessmentCodeRe = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const rubricRefRe = /^[A-Z0-9][A-Z0-9_-]*$/;

export type AssessmentImportOption = {
  id: string;
  text: string;
  points: number;
};

export type AssessmentImportRubricLevel = {
  score: number;
  descriptor: string;
};

export type AssessmentImportRubricCriterion = {
  name: string;
  max_score: number;
  levels: AssessmentImportRubricLevel[];
};

export type AssessmentImportRubric = {
  ref: string;
  title: string;
  criteria: AssessmentImportRubricCriterion[];
};

export type AssessmentImportSection = {
  code: string;
  title: string;
  max_score: number | null;
  counts_in_total: boolean;
  instructions_md?: string;
};

export type AssessmentImportAssessment = {
  code: string;
  title: string;
  type: AssessmentType;
  instructions_md: string;
  time_guide_min: number;
  is_sample: boolean;
};

export type AssessmentImportItem = {
  ref: string;
  section: string;
  type: ItemType;
  domain: string;
  difficulty?: number;
  points: number;
  prompt_md: string;
  options?: AssessmentImportOption[];
  response_format?: ResponseFormat;
  department?: string;
  rubric?: string;
  model_answer_md?: string;
  explanation_md?: string;
  marking_notes_md?: string;
  sort_order?: number;
};

export type AssessmentImportFile = {
  assessment: AssessmentImportAssessment;
  sections: AssessmentImportSection[];
  rubrics: AssessmentImportRubric[];
  items: AssessmentImportItem[];
};

export type SectionPointsReport = {
  code: string;
  itemPoints: number;
  maxScore: number | null;
  ok: boolean;
  byDepartment?: Record<string, { itemPoints: number; ok: boolean }>;
};

export type AssessmentImportValidation = {
  ok: boolean;
  errors: string[];
  sections: SectionPointsReport[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function rubricMaxScore(rubric: AssessmentImportRubric): number {
  return rubric.criteria.reduce((sum, c) => sum + c.max_score, 0);
}

function parseTopLevel(data: unknown): { file?: AssessmentImportFile; errors: string[] } {
  const errors: string[] = [];
  if (!isRecord(data)) {
    return { errors: ["The file must be a JSON object."] };
  }
  for (const key of ["assessment", "sections", "rubrics", "items"]) {
    if (!(key in data)) {
      errors.push(`Missing top-level "${key}" array or object.`);
    }
  }
  if (errors.length > 0) {
    return { errors };
  }
  return { file: data as AssessmentImportFile, errors: [] };
}

export function parseAssessmentImportJson(text: string): { ok: true; data: AssessmentImportFile } | { ok: false; errors: string[] } {
  if (text.trim() === "") {
    return { ok: false, errors: ["The file is empty."] };
  }
  try {
    const parsed = JSON.parse(text) as unknown;
    const { file, errors } = parseTopLevel(parsed);
    if (!file || errors.length > 0) {
      return { ok: false, errors };
    }
    return { ok: true, data: file };
  } catch (error) {
    const detail = error instanceof Error ? ` (${error.message})` : "";
    return { ok: false, errors: [`That is not valid JSON${detail}.`] };
  }
}

function validateAssessmentMeta(assessment: unknown, errors: string[]): void {
  if (!isRecord(assessment)) {
    errors.push("The assessment block must be an object.");
    return;
  }
  const code = typeof assessment.code === "string" ? assessment.code.trim() : "";
  if (!code) {
    errors.push("Assessment code is required.");
  } else if (!assessmentCodeRe.test(code)) {
    errors.push("Assessment code must be lowercase letters, numbers and hyphens.");
  }
  if (typeof assessment.title !== "string" || !assessment.title.trim()) {
    errors.push("Assessment title is required.");
  }
  const type = assessment.type;
  if (typeof type !== "string" || !assessmentTypes.includes(type as AssessmentType)) {
    errors.push(`Assessment type must be one of: ${assessmentTypes.join(", ")}.`);
  }
  if (typeof assessment.instructions_md !== "string") {
    errors.push("Assessment instructions_md must be a string.");
  }
  const time = assessment.time_guide_min;
  if (!Number.isInteger(time) || (time as number) <= 0) {
    errors.push("time_guide_min must be a positive whole number.");
  }
  if (typeof assessment.is_sample !== "boolean") {
    errors.push("is_sample must be true or false.");
  }
}

function validateRubrics(rubrics: unknown, errors: string[]): Map<string, AssessmentImportRubric> {
  const byRef = new Map<string, AssessmentImportRubric>();
  if (!Array.isArray(rubrics)) {
    errors.push("rubrics must be an array.");
    return byRef;
  }
  for (const [index, raw] of rubrics.entries()) {
    if (!isRecord(raw)) {
      errors.push(`Rubric ${index + 1} must be an object.`);
      continue;
    }
    const ref = typeof raw.ref === "string" ? raw.ref.trim() : "";
    if (!ref) {
      errors.push(`Rubric ${index + 1} needs a ref.`);
      continue;
    }
    if (!rubricRefRe.test(ref)) {
      errors.push(`Rubric ref "${ref}" must start with A–Z or 0–9 and use only A–Z, 0–9, _ and -.`);
    }
    if (byRef.has(ref)) {
      errors.push(`Duplicate rubric ref "${ref}".`);
    }
    if (typeof raw.title !== "string" || !raw.title.trim()) {
      errors.push(`Rubric "${ref}" needs a title.`);
    }
    if (!Array.isArray(raw.criteria) || raw.criteria.length === 0) {
      errors.push(`Rubric "${ref}" needs at least one criterion.`);
      continue;
    }
    const criteria: AssessmentImportRubricCriterion[] = [];
    for (const [cIdx, cRaw] of raw.criteria.entries()) {
      if (!isRecord(cRaw)) {
        errors.push(`Rubric "${ref}" criterion ${cIdx + 1} must be an object.`);
        continue;
      }
      const name = typeof cRaw.name === "string" ? cRaw.name.trim() : "";
      const maxScore = cRaw.max_score;
      if (!name) {
        errors.push(`Rubric "${ref}" criterion ${cIdx + 1} needs a name.`);
      }
      if (!Number.isInteger(maxScore) || (maxScore as number) < 0) {
        errors.push(`Rubric "${ref}" criterion "${name || cIdx + 1}" max_score must be a whole number ≥ 0.`);
      }
      if (!Array.isArray(cRaw.levels) || cRaw.levels.length === 0) {
        errors.push(`Rubric "${ref}" criterion "${name || cIdx + 1}" needs at least one level.`);
        continue;
      }
      const levels: AssessmentImportRubricLevel[] = [];
      const scores = new Set<number>();
      for (const level of cRaw.levels) {
        if (!isRecord(level)) {
          continue;
        }
        const score = level.score;
        const descriptor = typeof level.descriptor === "string" ? level.descriptor.trim() : "";
        if (!Number.isInteger(score) || (score as number) < 0) {
          errors.push(`Rubric "${ref}" levels must use whole-number scores ≥ 0.`);
        } else if (Number.isInteger(maxScore) && (score as number) > (maxScore as number)) {
          errors.push(`Rubric "${ref}" level score ${score} exceeds criterion max ${maxScore}.`);
        }
        if (!descriptor) {
          errors.push(`Rubric "${ref}" every level needs a descriptor.`);
        }
        if (scores.has(score as number)) {
          errors.push(`Rubric "${ref}" criterion "${name}" repeats level score ${score}.`);
        }
        scores.add(score as number);
        levels.push({ score: score as number, descriptor });
      }
      criteria.push({
        name: name || `Criterion ${cIdx + 1}`,
        max_score: maxScore as number,
        levels,
      });
    }
    const rubric: AssessmentImportRubric = {
      ref,
      title: (raw.title as string).trim(),
      criteria,
    };
    byRef.set(ref, rubric);
  }
  return byRef;
}

function validateSectionsAgainstSettings(
  sections: unknown,
  week0: Week0Sections,
  errors: string[],
): Map<string, AssessmentImportSection> {
  const byCode = new Map<string, AssessmentImportSection>();
  if (!Array.isArray(sections)) {
    errors.push("sections must be an array.");
    return byCode;
  }
  const expected = week0.sections;
  const expectedCodes = new Set(expected.map((s) => s.code));

  for (const [index, raw] of sections.entries()) {
    if (!isRecord(raw)) {
      errors.push(`Section ${index + 1} must be an object.`);
      continue;
    }
    const code = typeof raw.code === "string" ? raw.code.trim() : "";
    if (!code) {
      errors.push(`Section ${index + 1} needs a code.`);
      continue;
    }
    if (byCode.has(code)) {
      errors.push(`Duplicate section code "${code}".`);
    }
    const setting = expected.find((s) => s.code === code);
    if (!setting) {
      errors.push(`Unknown section code "${code}".`);
      continue;
    }
    const maxScore = raw.max_score;
    if (maxScore !== null && maxScore !== undefined) {
      const maxNum = maxScore as number;
      if (!Number.isInteger(maxNum) || maxNum < 0) {
        errors.push(`Section "${code}" max_score must be a whole number ≥ 0 or null.`);
      } else if (setting.max !== maxNum) {
        errors.push(
          `Section "${code}" max_score is ${maxNum} but placement.week0_sections expects ${setting.max}.`,
        );
      }
    } else if (setting.max !== null) {
      errors.push(`Section "${code}" must set max_score to ${setting.max}.`);
    }
    if (typeof raw.counts_in_total !== "boolean") {
      errors.push(`Section "${code}" must set counts_in_total true or false.`);
    } else if (raw.counts_in_total !== setting.counts_in_total) {
      errors.push(
        `Section "${code}" counts_in_total is ${String(raw.counts_in_total)} but settings expect ${String(setting.counts_in_total)}.`,
      );
    }
    if (typeof raw.title !== "string" || !raw.title.trim()) {
      errors.push(`Section "${code}" needs a title.`);
    }
    const section: AssessmentImportSection = {
      code,
      title: (raw.title as string).trim(),
      max_score:
        maxScore === undefined || maxScore === null ? (maxScore as null) : (maxScore as number),
      counts_in_total: raw.counts_in_total as boolean,
      instructions_md: typeof raw.instructions_md === "string" ? raw.instructions_md : "",
    };
    byCode.set(code, section);
  }

  for (const code of expectedCodes) {
    if (!byCode.has(code)) {
      errors.push(`Missing section "${code}" required by placement.week0_sections.`);
    }
  }

  return byCode;
}

function validateItems(
  items: unknown,
  sections: Map<string, AssessmentImportSection>,
  rubrics: Map<string, AssessmentImportRubric>,
  week0: Week0Sections,
  errors: string[],
): SectionPointsReport[] {
  const sectionTotals = new Map<string, number>();
  const departmentTotals = new Map<string, number>();
  const reports: SectionPointsReport[] = [];

  if (!Array.isArray(items)) {
    errors.push("items must be an array.");
    return reports;
  }
  if (items.length === 0) {
    errors.push("Add at least one item.");
    return reports;
  }

  const refs = new Set<string>();

  for (const [index, raw] of items.entries()) {
    if (!isRecord(raw)) {
      errors.push(`Item ${index + 1} must be an object.`);
      continue;
    }
    const ref = typeof raw.ref === "string" ? raw.ref.trim() : "";
    if (!ref) {
      errors.push(`Item ${index + 1} needs a ref.`);
      continue;
    }
    if (!itemRefRe.test(ref)) {
      errors.push(`Item ref "${ref}" must start with A–Z or 0–9 and use only A–Z, 0–9, _ and -.`);
    }
    if (refs.has(ref)) {
      errors.push(`Duplicate item ref "${ref}".`);
    }
    refs.add(ref);

    const sectionCode = typeof raw.section === "string" ? raw.section.trim() : "";
    if (!sectionCode || !sections.has(sectionCode)) {
      errors.push(`Item "${ref}" section "${sectionCode}" is not defined in sections.`);
      continue;
    }

    const type = raw.type;
    if (typeof type !== "string" || !itemTypes.includes(type as ItemType)) {
      errors.push(`Item "${ref}" type must be one of: ${itemTypes.join(", ")}.`);
      continue;
    }

    const domain = typeof raw.domain === "string" ? raw.domain.trim().toUpperCase() : "";
    if (!domain || !importDomainCodes.includes(domain as (typeof importDomainCodes)[number])) {
      errors.push(`Item "${ref}" domain must be one of: ${importDomainCodes.join(", ")}.`);
    }

    const difficulty = raw.difficulty;
    if (difficulty !== undefined) {
      if (!Number.isInteger(difficulty) || (difficulty as number) < 1 || (difficulty as number) > 3) {
        errors.push(`Item "${ref}" difficulty must be 1, 2 or 3 when set.`);
      }
    } else if (type !== "profile") {
      errors.push(`Item "${ref}" needs difficulty 1–3.`);
    }

    const points = raw.points;
    if (!Number.isInteger(points) || (points as number) < 0) {
      errors.push(`Item "${ref}" points must be a whole number ≥ 0.`);
      continue;
    }

    if (typeof raw.prompt_md !== "string" || !raw.prompt_md.trim()) {
      errors.push(`Item "${ref}" needs prompt_md.`);
    }

    const department =
      typeof raw.department === "string" ? raw.department.trim().toLowerCase() : undefined;

    if (sectionCode === "department") {
      if (!department) {
        errors.push(`Item "${ref}" in the department section needs a department code.`);
      } else if (
        !departmentSectionDepartmentCodes.includes(
          department as (typeof departmentSectionDepartmentCodes)[number],
        )
      ) {
        errors.push(
          `Item "${ref}" department must be one of: ${departmentSectionDepartmentCodes.join(", ")}.`,
        );
      } else if (!importDepartmentCodes.includes(department as (typeof importDepartmentCodes)[number])) {
        errors.push(`Item "${ref}" uses unknown department code "${department}".`);
      }
    } else if (department) {
      errors.push(`Item "${ref}" must not set department outside the department section.`);
    }

    if (type === "profile") {
      if ((points as number) !== 0) {
        errors.push(`Profile item "${ref}" must have points 0.`);
      }
      if (raw.rubric) {
        errors.push(`Profile item "${ref}" must not reference a rubric.`);
      }
      if (!Array.isArray(raw.options) || raw.options.length < 2) {
        errors.push(`Profile item "${ref}" needs at least two options.`);
      }
    }

    if (type === "choice") {
      if (!Array.isArray(raw.options) || raw.options.length < 2) {
        errors.push(`Choice item "${ref}" needs at least two options.`);
      } else {
        const optionIds = new Set<string>();
        let best = -1;
        for (const [oIdx, opt] of raw.options.entries()) {
          if (!isRecord(opt)) {
            errors.push(`Item "${ref}" option ${oIdx + 1} must be an object.`);
            continue;
          }
          const id = typeof opt.id === "string" ? opt.id.trim() : "";
          const text = typeof opt.text === "string" ? opt.text.trim() : "";
          const optPoints = opt.points;
          if (!id) {
            errors.push(`Item "${ref}" option ${oIdx + 1} needs an id.`);
          } else if (optionIds.has(id)) {
            errors.push(`Item "${ref}" repeats option id "${id}".`);
          } else {
            optionIds.add(id);
          }
          if (!text) {
            errors.push(`Item "${ref}" option "${id || oIdx + 1}" needs text.`);
          }
          if (!Number.isInteger(optPoints) || (optPoints as number) < 0) {
            errors.push(`Item "${ref}" option "${id}" points must be a whole number ≥ 0.`);
          } else {
            best = Math.max(best, optPoints as number);
            if ((optPoints as number) > (points as number)) {
              errors.push(`Item "${ref}" option "${id}" points cannot exceed the item maximum (${points}).`);
            }
          }
        }
        if (best !== (points as number)) {
          errors.push(
            `Choice item "${ref}" best option points (${best}) must equal item points (${points}).`,
          );
        }
      }
      if (raw.rubric) {
        errors.push(`Choice item "${ref}" must not reference a rubric.`);
      }
    }

    const responseFormat = raw.response_format;
    if (type === "short_text" || type === "practical") {
      if (
        typeof responseFormat !== "string" ||
        !responseFormats.includes(responseFormat as ResponseFormat)
      ) {
        errors.push(
          `Item "${ref}" needs response_format: ${responseFormats.join(", ")}.`,
        );
      }
    } else if (responseFormat !== undefined && responseFormat !== null) {
      errors.push(`Item "${ref}" must not set response_format for type ${type}.`);
    }

    const rubricRef = typeof raw.rubric === "string" ? raw.rubric.trim() : undefined;
    if (type === "practical") {
      if (!rubricRef) {
        errors.push(`Practical item "${ref}" needs a rubric ref.`);
      }
    }
    if ((type === "short_text" || type === "practical") && (points as number) > 0) {
      if (!rubricRef) {
        errors.push(`Item "${ref}" with points needs a rubric for marking.`);
      } else if (!rubrics.has(rubricRef)) {
        errors.push(`Item "${ref}" rubric "${rubricRef}" is not defined in rubrics.`);
      } else {
        const rubricMax = rubricMaxScore(rubrics.get(rubricRef)!);
        if (rubricMax !== (points as number)) {
          errors.push(
            `Item "${ref}" points (${points}) must equal rubric "${rubricRef}" maximum (${rubricMax}).`,
          );
        }
      }
    } else if (rubricRef) {
      if (!rubrics.has(rubricRef)) {
        errors.push(`Item "${ref}" rubric "${rubricRef}" is not defined in rubrics.`);
      }
    }

    sectionTotals.set(sectionCode, (sectionTotals.get(sectionCode) ?? 0) + (points as number));
    if (sectionCode === "department" && department) {
      departmentTotals.set(department, (departmentTotals.get(department) ?? 0) + (points as number));
    }
  }

  for (const setting of week0.sections) {
    const itemPoints = sectionTotals.get(setting.code) ?? 0;
    const maxScore = setting.max;
    let ok = true;
    let byDepartment: SectionPointsReport["byDepartment"];

    if (setting.code === "department" && maxScore !== null) {
      byDepartment = {};
      for (const dep of departmentSectionDepartmentCodes) {
        const depPoints = departmentTotals.get(dep) ?? 0;
        const depOk = depPoints === maxScore;
        byDepartment[dep] = { itemPoints: depPoints, ok: depOk };
        if (!depOk) {
          ok = false;
          errors.push(
            `Department section: "${dep}" item points sum to ${depPoints} but must be ${maxScore}.`,
          );
        }
      }
    } else if (maxScore === null) {
      ok = true;
    } else if (itemPoints !== maxScore) {
      ok = false;
      errors.push(
        `Section "${setting.code}" item points sum to ${itemPoints} but max_score is ${maxScore}.`,
      );
    }

    reports.push({
      code: setting.code,
      itemPoints,
      maxScore,
      ok,
      byDepartment,
    });
  }

  return reports;
}

export type ValidateAssessmentImportOptions = {
  /** Parsed `placement.week0_sections` from app_settings (or curriculum seed). */
  week0Sections: unknown;
};

/**
 * Validates an assessment import file before creating a draft in the database.
 * Rules mirror Prompt 07 spec F.2 and `docs/content/ASSESSMENT_FORMAT.md`.
 */
export function validateAssessmentImport(
  data: unknown,
  options: ValidateAssessmentImportOptions,
): AssessmentImportValidation {
  const errors: string[] = [];
  const week0Check = checkWeek0Sections(options.week0Sections);
  if (!week0Check.ok) {
    return {
      ok: false,
      errors: ["placement.week0_sections is not valid.", ...week0Check.errors],
      sections: [],
    };
  }
  const week0 = week0Check.value;

  const { file, errors: shapeErrors } = parseTopLevel(data);
  errors.push(...shapeErrors);
  if (!file) {
    return { ok: false, errors, sections: [] };
  }

  validateAssessmentMeta(file.assessment, errors);
  const rubricMap = validateRubrics(file.rubrics, errors);
  const sectionMap = validateSectionsAgainstSettings(file.sections, week0, errors);
  const sections = validateItems(file.items, sectionMap, rubricMap, week0, errors);

  return {
    ok: errors.length === 0,
    errors,
    sections,
  };
}

/** Default Week 0 section maxima from the curriculum seed file. */
export function defaultWeek0SectionsFromSeed(): Week0Sections {
  const seed = {
    sections: [
      { code: "knowledge", name: "Knowledge", max: 25, counts_in_total: true },
      { code: "prompting", name: "Prompting", max: 25, counts_in_total: true },
      { code: "department", name: "Department task", max: 25, counts_in_total: true },
      { code: "safety", name: "Safety and judgement", max: 15, counts_in_total: true },
      { code: "workflow", name: "Workflow", max: 10, counts_in_total: true },
      {
        code: "technical",
        name: "Technical supplement (optional)",
        max: null,
        counts_in_total: false,
      },
    ],
  };
  const checked = checkWeek0Sections(seed);
  if (!checked.ok) {
    throw new Error("Seed week0 sections fixture is invalid.");
  }
  return checked.value;
}
