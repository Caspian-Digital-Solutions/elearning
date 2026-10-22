import type { AssessmentImportRubric } from "@/lib/assessments/import";
import { allowedSubmissionLinkHosts, type ReviewTotals, type SubmissionType } from "@/lib/assignments/types";

const rubricRefRe = /^[A-Z0-9][A-Z0-9_-]*$/;
const assignmentCodeRe = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export function rubricMaxTotal(rubric: AssessmentImportRubric): number {
  return rubric.criteria.reduce((sum, criterion) => sum + criterion.max_score, 0);
}

export function validateEmbeddedRubrics(
  rubrics: unknown,
  errors: string[],
): Map<string, AssessmentImportRubric> {
  const byRef = new Map<string, AssessmentImportRubric>();
  if (!Array.isArray(rubrics)) {
    errors.push("rubrics must be an array.");
    return byRef;
  }
  for (const [index, raw] of rubrics.entries()) {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
      errors.push(`Rubric ${index + 1} must be an object.`);
      continue;
    }
    const record = raw as Record<string, unknown>;
    const ref = typeof record.ref === "string" ? record.ref.trim() : "";
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
    if (typeof record.title !== "string" || !record.title.trim()) {
      errors.push(`Rubric "${ref}" needs a title.`);
    }
    if (!Array.isArray(record.criteria) || record.criteria.length === 0) {
      errors.push(`Rubric "${ref}" needs at least one criterion.`);
      continue;
    }
    const criteria: AssessmentImportRubric["criteria"] = [];
    for (const [cIdx, cRaw] of record.criteria.entries()) {
      if (typeof cRaw !== "object" || cRaw === null || Array.isArray(cRaw)) {
        errors.push(`Rubric "${ref}" criterion ${cIdx + 1} must be an object.`);
        continue;
      }
      const cRecord = cRaw as Record<string, unknown>;
      const name = typeof cRecord.name === "string" ? cRecord.name.trim() : "";
      const maxScore = cRecord.max_score;
      if (!name) {
        errors.push(`Rubric "${ref}" criterion ${cIdx + 1} needs a name.`);
      }
      if (!Number.isInteger(maxScore) || (maxScore as number) < 0) {
        errors.push(
          `Rubric "${ref}" criterion "${name || String(cIdx + 1)}" max_score must be a whole number ≥ 0.`,
        );
      }
      if (!Array.isArray(cRecord.levels) || cRecord.levels.length === 0) {
        errors.push(`Rubric "${ref}" criterion "${name || String(cIdx + 1)}" needs at least one level.`);
        continue;
      }
      const levels: AssessmentImportRubric["criteria"][number]["levels"] = [];
      const scores = new Set<number>();
      for (const level of cRecord.levels) {
        if (typeof level !== "object" || level === null || Array.isArray(level)) {
          continue;
        }
        const lRecord = level as Record<string, unknown>;
        const score = lRecord.score;
        const descriptor = typeof lRecord.descriptor === "string" ? lRecord.descriptor.trim() : "";
        if (!Number.isInteger(score) || (score as number) < 0) {
          errors.push(`Rubric "${ref}" criterion "${name}" level score must be a whole number ≥ 0.`);
          continue;
        }
        if ((score as number) > (maxScore as number)) {
          errors.push(`Rubric "${ref}" criterion "${name}" level score cannot exceed max_score.`);
        }
        if (!descriptor) {
          errors.push(`Rubric "${ref}" criterion "${name}" level needs a descriptor.`);
        }
        if (scores.has(score as number)) {
          errors.push(`Rubric "${ref}" criterion "${name}" has duplicate level score ${score}.`);
        }
        scores.add(score as number);
        levels.push({ score: score as number, descriptor });
      }
      criteria.push({
        name,
        max_score: maxScore as number,
        levels,
      });
    }
    byRef.set(ref, {
      ref,
      title: (record.title as string).trim(),
      criteria,
    });
  }
  return byRef;
}

export function validateAssignmentCode(code: string, errors: string[], label = "Assignment"): void {
  if (!code) {
    errors.push(`${label} code is required.`);
  } else if (!assignmentCodeRe.test(code)) {
    errors.push(`${label} code must be lowercase letters, numbers and hyphens.`);
  }
}

export function validatePassMarkPct(value: unknown, errors: string[], label = "pass_mark_pct"): void {
  if (!Number.isInteger(value) || (value as number) < 0 || (value as number) > 100) {
    errors.push(`${label} must be a whole number from 0 to 100.`);
  }
}

export function validateSubmissionTypes(types: unknown, errors: string[]): SubmissionType[] {
  if (!Array.isArray(types) || types.length === 0) {
    errors.push("At least one submission type is required (link, file, text).");
    return [];
  }
  const allowed = new Set<string>(["link", "file", "text"]);
  const parsed: SubmissionType[] = [];
  for (const entry of types) {
    if (typeof entry !== "string" || !allowed.has(entry)) {
      errors.push(`Invalid submission type "${String(entry)}". Use link, file or text.`);
      continue;
    }
    if (!parsed.includes(entry as SubmissionType)) {
      parsed.push(entry as SubmissionType);
    }
  }
  if (parsed.length === 0) {
    errors.push("At least one valid submission type is required.");
  }
  return parsed;
}

export function normaliseLinkHost(url: string): string | null {
  try {
    const parsed = new URL(url.trim());
    if (parsed.protocol !== "https:") {
      return null;
    }
    return parsed.hostname.toLowerCase();
  } catch {
    return null;
  }
}

export function isAllowedSubmissionLink(url: string): boolean {
  const host = normaliseLinkHost(url);
  if (!host) {
    return false;
  }
  return (allowedSubmissionLinkHosts as readonly string[]).includes(host);
}

export function markPercentage(total: number, maxTotal: number): number {
  if (maxTotal <= 0) {
    return 0;
  }
  return (total / maxTotal) * 100;
}

export function assignmentMarkPassed(total: number, maxTotal: number, passMarkPct: number): boolean {
  return markPercentage(total, maxTotal) >= passMarkPct;
}

export function differenceShareOfMaximum(
  primaryTotal: number,
  doubleTotal: number,
  maxTotal: number,
): number {
  if (maxTotal <= 0) {
    return 0;
  }
  return Math.abs(primaryTotal - doubleTotal) / maxTotal;
}

export function differenceRequiresFinalReview(
  primaryTotal: number,
  doubleTotal: number,
  maxTotal: number,
  thresholdPct: number,
): boolean {
  const share = differenceShareOfMaximum(primaryTotal, doubleTotal, maxTotal);
  return share * 100 >= thresholdPct;
}

export function selectReleasedReviewTotal(reviews: readonly ReviewTotals[]): number | null {
  const finalReview = reviews.find((review) => review.kind === "final");
  if (finalReview) {
    return finalReview.total;
  }
  const primary = reviews.find((review) => review.kind === "primary");
  return primary?.total ?? null;
}

export function doubleMarkSampleSize(poolSize: number, samplePct: number): number {
  if (poolSize <= 0) {
    return 0;
  }
  return Math.max(1, Math.ceil((poolSize * samplePct) / 100));
}

export type SubmissionForDoubleMark = {
  id: string;
  learnerId: string;
  departmentId: string;
};

export type DepartmentChampions = {
  departmentId: string;
  championUserIds: string[];
};

export type DoubleMarkSamplingReport = {
  assignments: { submissionId: string; reviewerId: string; departmentId: string }[];
  skippedDepartments: { departmentId: string; reason: string }[];
};

export function assignDoubleMarkSample(
  submissions: readonly SubmissionForDoubleMark[],
  champions: readonly DepartmentChampions[],
  samplePct: number,
  random: () => number = Math.random,
): DoubleMarkSamplingReport {
  const championByDept = new Map(champions.map((row) => [row.departmentId, row.championUserIds]));
  const byDept = new Map<string, SubmissionForDoubleMark[]>();
  for (const submission of submissions) {
    const list = byDept.get(submission.departmentId) ?? [];
    list.push(submission);
    byDept.set(submission.departmentId, list);
  }

  const assignments: DoubleMarkSamplingReport["assignments"] = [];
  const skippedDepartments: DoubleMarkSamplingReport["skippedDepartments"] = [];

  for (const [departmentId, pool] of byDept.entries()) {
    const championIds = championByDept.get(departmentId) ?? [];
    if (championIds.length === 0) {
      skippedDepartments.push({
        departmentId,
        reason: "No active champion in this department.",
      });
      continue;
    }
    const sampleSize = doubleMarkSampleSize(pool.length, samplePct);
    const shuffled = [...pool];
    for (let i = shuffled.length - 1; i > 0; i -= 1) {
      const j = Math.floor(random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const picked = shuffled.slice(0, sampleSize);
    for (const submission of picked) {
      const eligible = championIds.filter((id) => id !== submission.learnerId);
      if (eligible.length === 0) {
        skippedDepartments.push({
          departmentId,
          reason: "Only champion is the learner; cannot double-mark own work.",
        });
        continue;
      }
      const reviewerId = eligible[Math.floor(random() * eligible.length)];
      assignments.push({ submissionId: submission.id, reviewerId, departmentId });
    }
  }

  return { assignments, skippedDepartments };
}
