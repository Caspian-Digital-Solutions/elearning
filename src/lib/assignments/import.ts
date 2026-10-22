import type { AssessmentImportRubric } from "@/lib/assessments/import";
import { importDepartmentCodes } from "@/lib/assessments/import";
import type { SubmissionType } from "@/lib/assignments/types";
import {
  rubricMaxTotal,
  validateAssignmentCode,
  validateEmbeddedRubrics,
  validatePassMarkPct,
  validateSubmissionTypes,
} from "@/lib/assignments/validators";

export type AssignmentImportEntry = {
  code: string;
  title: string;
  module_code: string;
  brief_md: string;
  rubric_ref: string;
  submission_types: SubmissionType[];
  department_code?: string | null;
  pass_mark_pct: number;
  is_test_out: boolean;
  is_sample: boolean;
};

export type AssignmentImportFile = {
  assignments: AssignmentImportEntry[];
  rubrics: AssessmentImportRubric[];
};

export type AssignmentImportValidation = {
  ok: boolean;
  errors: string[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseAssignmentImportJson(
  text: string,
): { ok: true; data: AssignmentImportFile } | { ok: false; errors: string[] } {
  if (text.trim() === "") {
    return { ok: false, errors: ["The file is empty."] };
  }
  try {
    const parsed = JSON.parse(text) as unknown;
    if (!isRecord(parsed)) {
      return { ok: false, errors: ["The file must be a JSON object."] };
    }
    if (!Array.isArray(parsed.assignments)) {
      return { ok: false, errors: ['Missing top-level "assignments" array.'] };
    }
    if (!("rubrics" in parsed)) {
      return { ok: false, errors: ['Missing top-level "rubrics" array.'] };
    }
    return {
      ok: true,
      data: {
        assignments: parsed.assignments as AssignmentImportEntry[],
        rubrics: (parsed.rubrics ?? []) as AssessmentImportRubric[],
      },
    };
  } catch (error) {
    const detail = error instanceof Error ? ` (${error.message})` : "";
    return { ok: false, errors: [`That is not valid JSON${detail}.`] };
  }
}

export type ValidateAssignmentImportOptions = {
  moduleCodes: readonly string[];
  departmentCodes?: readonly string[];
};

function validateAssignmentEntry(
  raw: unknown,
  index: number,
  rubricsByRef: Map<string, AssessmentImportRubric>,
  options: ValidateAssignmentImportOptions,
  errors: string[],
): void {
  const label = `Assignment ${index + 1}`;
  if (!isRecord(raw)) {
    errors.push(`${label} must be an object.`);
    return;
  }
  const code = typeof raw.code === "string" ? raw.code.trim() : "";
  validateAssignmentCode(code, errors, label);
  if (typeof raw.title !== "string" || !raw.title.trim()) {
    errors.push(`${label} title is required.`);
  }
  const moduleCode =
    typeof raw.module_code === "string" ? raw.module_code.trim().toLowerCase() : "";
  if (!moduleCode) {
    errors.push(`${label} module_code is required.`);
  } else if (!options.moduleCodes.map((m) => m.toLowerCase()).includes(moduleCode)) {
    errors.push(`${label} module_code "${moduleCode}" is not in the curriculum.`);
  }
  if (typeof raw.brief_md !== "string" || !raw.brief_md.trim()) {
    errors.push(`${label} brief_md is required.`);
  }
  const rubricRef = typeof raw.rubric_ref === "string" ? raw.rubric_ref.trim() : "";
  if (!rubricRef) {
    errors.push(`${label} rubric_ref is required.`);
  } else if (!rubricsByRef.has(rubricRef)) {
    errors.push(`${label} rubric_ref "${rubricRef}" was not found in rubrics.`);
  }
  validateSubmissionTypes(raw.submission_types, errors);
  validatePassMarkPct(raw.pass_mark_pct, errors, `${label} pass_mark_pct`);
  if (typeof raw.is_test_out !== "boolean") {
    errors.push(`${label} is_test_out must be true or false.`);
  }
  if (typeof raw.is_sample !== "boolean") {
    errors.push(`${label} is_sample must be true or false.`);
  }
  if (raw.department_code !== undefined && raw.department_code !== null) {
    const dept =
      typeof raw.department_code === "string" ? raw.department_code.trim().toLowerCase() : "";
    const allowed = (options.departmentCodes ?? importDepartmentCodes).map((d) => d.toLowerCase());
    if (!dept) {
      errors.push(`${label} department_code must be a non-empty string when set.`);
    } else if (!allowed.includes(dept)) {
      errors.push(`${label} department_code "${dept}" is not a known department.`);
    }
  }
  const rubric = rubricsByRef.get(rubricRef);
  if (rubric && rubricMaxTotal(rubric) <= 0) {
    errors.push(`${label} rubric "${rubricRef}" must have a positive maximum score.`);
  }
}

export function validateAssignmentImport(
  data: unknown,
  options: ValidateAssignmentImportOptions,
): AssignmentImportValidation {
  const errors: string[] = [];
  if (!isRecord(data)) {
    return { ok: false, errors: ["The file must be a JSON object."] };
  }
  if (!Array.isArray(data.assignments) || data.assignments.length === 0) {
    errors.push("At least one assignment entry is required.");
  }
  const rubricsByRef = validateEmbeddedRubrics(data.rubrics, errors);
  const codes = new Set<string>();
  if (Array.isArray(data.assignments)) {
    for (const [index, entry] of data.assignments.entries()) {
      validateAssignmentEntry(entry, index, rubricsByRef, options, errors);
      if (isRecord(entry) && typeof entry.code === "string") {
        const code = entry.code.trim();
        if (codes.has(code)) {
          errors.push(`Duplicate assignment code "${code}" in this file.`);
        }
        codes.add(code);
      }
    }
  }
  return { ok: errors.length === 0, errors };
}
