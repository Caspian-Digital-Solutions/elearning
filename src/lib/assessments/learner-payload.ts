export type AssessmentType = "placement" | "quiz" | "safety_quiz" | "capstone";
export type ItemType = "profile" | "choice" | "short_text" | "practical";
export type ResponseFormat = "text" | "prompt_and_output" | "link";

export type AssessmentRow = {
  id: string;
  code: string;
  title: string;
  type: AssessmentType;
  instructions_md: string;
  time_guide_min: number | null;
  is_sample: boolean;
  version: number;
};

export type SectionRow = {
  id: string;
  code: string;
  title: string;
  max_score: number | null;
  counts_in_total: boolean;
  sort_order: number;
  instructions_md: string;
};

export type ItemRow = {
  id: string;
  ref: string;
  type: ItemType;
  sort_order: number;
  prompt_md: string;
  options: unknown;
  response_format: ResponseFormat | null;
  department_id: string | null;
  section_id: string;
};

export type LearnerChoiceOption = {
  id: string;
  text: string;
};

export type LearnerAssessmentItem = {
  id: string;
  ref: string;
  type: ItemType;
  sortOrder: number;
  promptMd: string;
  options: LearnerChoiceOption[];
  responseFormat: ResponseFormat | null;
  departmentId: string | null;
};

export type LearnerAssessmentSection = {
  id: string;
  code: string;
  title: string;
  maxScore: number | null;
  countsInTotal: boolean;
  sortOrder: number;
  instructionsMd: string;
  items: LearnerAssessmentItem[];
};

export type LearnerAssessmentPayload = {
  assessment: {
    id: string;
    code: string;
    title: string;
    type: AssessmentType;
    instructionsMd: string;
    timeGuideMin: number | null;
    isSample: boolean;
    version: number;
  };
  sections: LearnerAssessmentSection[];
};

/** Keys that must never appear in learner-facing assessment JSON. */
export const FORBIDDEN_LEARNER_PAYLOAD_KEYS = [
  "option_points",
  "model_answer_md",
  "explanation_md",
  "marking_notes_md",
  "points",
  "rubric_id",
  "correct_option_id",
] as const;

export type ForbiddenLearnerPayloadKey = (typeof FORBIDDEN_LEARNER_PAYLOAD_KEYS)[number];

function sanitiseOptions(raw: ItemRow["options"]): LearnerChoiceOption[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw
    .map((entry) => {
      if (typeof entry !== "object" || entry === null) {
        return null;
      }
      const record = entry as Record<string, unknown>;
      const id = typeof record.id === "string" ? record.id : null;
      const text = typeof record.text === "string" ? record.text : null;
      if (!id || text === null) {
        return null;
      }
      return { id, text };
    })
    .filter((option): option is LearnerChoiceOption => option !== null);
}

export function buildLearnerAssessmentPayload(
  assessment: AssessmentRow,
  sections: SectionRow[],
  items: ItemRow[],
): LearnerAssessmentPayload {
  const itemsBySection = new Map<string, LearnerAssessmentItem[]>();
  for (const item of items) {
    const list = itemsBySection.get(item.section_id) ?? [];
    list.push({
      id: item.id,
      ref: item.ref,
      type: item.type,
      sortOrder: item.sort_order,
      promptMd: item.prompt_md,
      options: sanitiseOptions(item.options),
      responseFormat: item.response_format,
      departmentId: item.department_id,
    });
    itemsBySection.set(item.section_id, list);
  }

  const orderedSections = [...sections].sort(
    (left, right) => left.sort_order - right.sort_order || left.code.localeCompare(right.code),
  );

  return {
    assessment: {
      id: assessment.id,
      code: assessment.code,
      title: assessment.title,
      type: assessment.type,
      instructionsMd: assessment.instructions_md,
      timeGuideMin: assessment.time_guide_min,
      isSample: assessment.is_sample,
      version: assessment.version,
    },
    sections: orderedSections.map((section) => {
      const sectionItems = itemsBySection.get(section.id) ?? [];
      sectionItems.sort(
        (left, right) => left.sortOrder - right.sortOrder || left.ref.localeCompare(right.ref),
      );
      return {
        id: section.id,
        code: section.code,
        title: section.title,
        maxScore: section.max_score,
        countsInTotal: section.counts_in_total,
        sortOrder: section.sort_order,
        instructionsMd: section.instructions_md,
        items: sectionItems,
      };
    }),
  };
}

export function findForbiddenLearnerPayloadKeys(
  value: unknown,
  path = "",
): string[] {
  const hits: string[] = [];
  if (value === null || typeof value !== "object") {
    return hits;
  }

  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      hits.push(...findForbiddenLearnerPayloadKeys(value[index], `${path}[${index}]`));
    }
    return hits;
  }

  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const fullPath = path ? `${path}.${key}` : key;
    if ((FORBIDDEN_LEARNER_PAYLOAD_KEYS as readonly string[]).includes(key)) {
      hits.push(fullPath);
    }
    hits.push(...findForbiddenLearnerPayloadKeys(child, fullPath));
  }

  return hits;
}
