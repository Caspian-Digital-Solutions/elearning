"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { authorise } from "@/lib/auth";
import { databaseMessage, notAllowed, type ActionResult } from "@/lib/actions/result";
import { createAssignmentsClient } from "@/lib/supabase/assignments-client";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/types/database";

const trainersMarking = ["trainer", "admin", "champion"] as const;

const saveMarkInput = z.strictObject({
  responseId: z.uuid(),
  criterionScores: z.record(z.string(), z.number()),
  commentMd: z.string().max(5000).optional(),
});

export async function saveMark(input: z.input<typeof saveMarkInput>): Promise<ActionResult> {
  if (!(await authorise(trainersMarking))) {
    return { ok: false, error: notAllowed };
  }
  const parsed = saveMarkInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "The mark could not be saved." };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("save_mark", {
    p_response_id: parsed.data.responseId,
    p_criterion_scores: parsed.data.criterionScores as Json,
    p_comment_md: parsed.data.commentMd ?? undefined,
  });
  if (error) {
    return { ok: false, error: databaseMessage(error, "The mark could not be saved.") };
  }
  revalidatePath("/trainer/marking");
  revalidatePath("/trainer/placements");
  return { ok: true, data: null };
}

export type MarkingDetail = {
  answer: Json;
  promptMd: string;
  modelAnswerMd: string | null;
  markingNotesMd: string | null;
  criteria: {
    id: string;
    name: string;
    maxScore: number;
    levels: { score: number; descriptor: string }[];
  }[];
};

export async function loadMarkingDetail(responseId: string): Promise<MarkingDetail | null> {
  if (!(await authorise(trainersMarking))) {
    return null;
  }
  const supabase = await createClient();
  const { data: response } = await supabase
    .from("responses")
    .select("id, answer, item_id")
    .eq("id", responseId)
    .maybeSingle();
  if (!response) {
    return null;
  }
  const { data: item } = await supabase
    .from("assessment_items")
    .select("prompt_md, rubric_id")
    .eq("id", response.item_id)
    .maybeSingle();
  const { data: keys } = await supabase
    .from("assessment_item_keys")
    .select("model_answer_md, marking_notes_md")
    .eq("item_id", response.item_id)
    .maybeSingle();

  const criteria: MarkingDetail["criteria"] = [];
  if (item?.rubric_id) {
    const { data: critRows } = await supabase
      .from("rubric_criteria")
      .select("id, name, max_score, sort_order")
      .eq("rubric_id", item.rubric_id)
      .order("sort_order");
    for (const crit of critRows ?? []) {
      const { data: levels } = await supabase
        .from("rubric_levels")
        .select("score, descriptor")
        .eq("criterion_id", crit.id)
        .order("score");
      criteria.push({
        id: crit.id,
        name: crit.name,
        maxScore: crit.max_score,
        levels: levels ?? [],
      });
    }
  }

  return {
    answer: response.answer,
    promptMd: item?.prompt_md ?? "",
    modelAnswerMd: keys?.model_answer_md ?? null,
    markingNotesMd: keys?.marking_notes_md ?? null,
    criteria,
  };
}

const assignmentReviewInput = z.strictObject({
  submissionId: z.uuid(),
  kind: z.enum(["primary", "double_mark", "final"]),
  criterionScores: z.record(z.string(), z.number()),
  feedbackMd: z.string().max(10_000).optional(),
});

export async function saveAssignmentReview(
  input: z.input<typeof assignmentReviewInput>,
): Promise<ActionResult> {
  if (!(await authorise(trainersMarking))) {
    return { ok: false, error: notAllowed };
  }
  const parsed = assignmentReviewInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "The mark could not be saved." };
  }
  const supabase = await createAssignmentsClient();
  const { error } = await supabase.rpc("save_review", {
    p_submission_id: parsed.data.submissionId,
    p_kind: parsed.data.kind,
    p_criterion_scores: parsed.data.criterionScores as Json,
    p_feedback_md: parsed.data.feedbackMd ?? undefined,
  });
  if (error) {
    return { ok: false, error: databaseMessage(error, "The mark could not be saved.") };
  }
  revalidatePath("/trainer/marking");
  return { ok: true, data: null };
}

export async function requestAssignmentResubmission(
  submissionId: string,
  feedbackMd: string,
): Promise<ActionResult> {
  if (!(await authorise(["trainer", "admin"]))) {
    return { ok: false, error: notAllowed };
  }
  const supabase = await createAssignmentsClient();
  const { error } = await supabase.rpc("request_resubmission", {
    p_submission_id: submissionId,
    p_feedback_md: feedbackMd,
  });
  if (error) {
    return { ok: false, error: databaseMessage(error, "Resubmission could not be requested.") };
  }
  revalidatePath("/trainer/marking");
  return { ok: true, data: null };
}

export async function releaseAssignmentFeedback(submissionId: string): Promise<ActionResult> {
  if (!(await authorise(["trainer", "admin"]))) {
    return { ok: false, error: notAllowed };
  }
  const supabase = await createAssignmentsClient();
  const { error } = await supabase.rpc("release_feedback", { p_submission_id: submissionId });
  if (error) {
    return { ok: false, error: databaseMessage(error, "Feedback could not be released.") };
  }
  revalidatePath("/trainer/marking");
  revalidatePath("/assignments");
  revalidatePath("/my-path");
  return { ok: true, data: null };
}

export async function assignDoubleMarks(assignmentId: string): Promise<ActionResult<Json>> {
  if (!(await authorise(["trainer", "admin"]))) {
    return { ok: false, error: notAllowed };
  }
  const supabase = await createAssignmentsClient();
  const { data, error } = await supabase.rpc("assign_double_marks", {
    p_assignment_id: assignmentId,
  });
  if (error) {
    return { ok: false, error: databaseMessage(error, "Double-marks could not be assigned.") };
  }
  revalidatePath("/trainer/marking");
  return { ok: true, data: (data ?? {}) as Json };
}

export type AssignmentMarkingDetail = {
  submissionId: string;
  attemptNo: number;
  briefMd: string;
  linkUrl: string | null;
  filePath: string | null;
  textMd: string | null;
  criteria: MarkingDetail["criteria"];
  reviewKind: "primary" | "double_mark" | "final";
  hidePrimaryTotal: boolean;
  primaryTotal: number | null;
  existingScores: Record<string, number>;
  feedbackMd: string;
};

export async function loadAssignmentMarkingDetail(
  submissionId: string,
): Promise<AssignmentMarkingDetail | null> {
  const user = await authorise(trainersMarking);
  if (!user) {
    return null;
  }
  const supabase = await createAssignmentsClient();
  const { data: submission } = await supabase
    .from("submissions")
    .select("id, attempt_no, link_url, file_path, text_md, assignment_id")
    .eq("id", submissionId)
    .maybeSingle();
  if (!submission) {
    return null;
  }
  const { data: assignment } = await supabase
    .from("assignments")
    .select("brief_md, rubric_id")
    .eq("id", submission.assignment_id)
    .maybeSingle();
  const criteria: MarkingDetail["criteria"] = [];
  if (assignment?.rubric_id) {
    const { data: critRows } = await supabase
      .from("rubric_criteria")
      .select("id, name, max_score, sort_order")
      .eq("rubric_id", assignment.rubric_id)
      .order("sort_order");
    for (const crit of critRows ?? []) {
      const { data: levels } = await supabase
        .from("rubric_levels")
        .select("score, descriptor")
        .eq("criterion_id", crit.id)
        .order("score");
      criteria.push({
        id: crit.id,
        name: crit.name,
        maxScore: crit.max_score,
        levels: levels ?? [],
      });
    }
  }

  const isChampion = user.role === "champion";
  const { data: assigned } = await supabase
    .from("review_assignments")
    .select("id")
    .eq("submission_id", submissionId)
    .eq("reviewer_id", user.id)
    .eq("kind", "double_mark")
    .maybeSingle();

  const reviewKind: AssignmentMarkingDetail["reviewKind"] =
    isChampion && assigned ? "double_mark" : "primary";

  const { data: reviews } = await supabase
    .from("reviews")
    .select("kind, total, criterion_scores, feedback_md, reviewer_id")
    .eq("submission_id", submissionId);

  const ownReview = reviews?.find((r) => r.reviewer_id === user.id);
  const primary = reviews?.find((r) => r.kind === "primary");
  const existingScores = (ownReview?.criterion_scores ?? {}) as Record<string, number>;

  return {
    submissionId,
    attemptNo: submission.attempt_no,
    briefMd: assignment?.brief_md ?? "",
    linkUrl: submission.link_url,
    filePath: submission.file_path,
    textMd: submission.text_md,
    criteria,
    reviewKind,
    hidePrimaryTotal: reviewKind === "double_mark",
    primaryTotal: reviewKind === "double_mark" ? null : primary ? Number(primary.total) : null,
    existingScores,
    feedbackMd: ownReview?.feedback_md ?? "",
  };
}
