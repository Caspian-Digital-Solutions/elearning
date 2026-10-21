import { describe, expect, it } from "vitest";
import {
  buildLearnerAssessmentPayload,
  findForbiddenLearnerPayloadKeys,
  type AssessmentRow,
  type ItemRow,
  type SectionRow,
} from "@/lib/assessments/learner-payload";

const assessment: AssessmentRow = {
  id: "asm-1",
  code: "week0",
  title: "Week 0",
  type: "placement",
  instructions_md: "Instructions",
  time_guide_min: 120,
  is_sample: false,
  version: 1,
};

const section: SectionRow = {
  id: "sec-1",
  code: "knowledge",
  title: "Knowledge",
  max_score: 25,
  counts_in_total: true,
  sort_order: 1,
  instructions_md: "",
};

describe("learner assessment payload", () => {
  it("strips marking fields and option points from choice items", () => {
    const item: ItemRow = {
      id: "item-1",
      ref: "K01",
      type: "choice",
      sort_order: 1,
      prompt_md: "Pick one",
      options: [
        { id: "a", text: "Wrong", points: 0 },
        { id: "b", text: "Right", points: 1, explanation_md: "secret" },
      ],
      response_format: null,
      department_id: null,
      section_id: section.id,
    };

    const payload = buildLearnerAssessmentPayload(assessment, [section], [item]);
    expect(payload.sections[0].items[0].options).toEqual([
      { id: "a", text: "Wrong" },
      { id: "b", text: "Right" },
    ]);

    const forbidden = findForbiddenLearnerPayloadKeys(payload);
    expect(forbidden).toEqual([]);
  });

  it("flags forbidden keys if they appear anywhere in the serialised tree", () => {
    const polluted = {
      assessment: { code: "week0" },
      sections: [{ items: [{ model_answer_md: "no" }] }],
    };
    expect(findForbiddenLearnerPayloadKeys(polluted)).toContain("sections[0].items[0].model_answer_md");
  });
});
