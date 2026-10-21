"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { authorise } from "@/lib/auth";
import { databaseMessage, notAllowed, type ActionResult } from "@/lib/actions/result";
import { streamValues } from "@/lib/people/labels";
import { loadQuizQuestionCheck, type QuizQuestionCheckRow } from "@/lib/assessments/queries";
import { createClient } from "@/lib/supabase/server";

const trainersAndAdmins = ["trainer", "admin"] as const;

export async function calculatePlacement(attemptId: string): Promise<ActionResult> {
  if (!(await authorise(trainersAndAdmins))) {
    return { ok: false, error: notAllowed };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("calculate_placement", { p_attempt_id: attemptId });
  if (error) {
    return { ok: false, error: databaseMessage(error, "Placement could not be calculated.") };
  }
  revalidatePath("/trainer/placements");
  return { ok: true, data: null };
}

const confirmInput = z.strictObject({
  attemptId: z.uuid(),
  stream: z.enum(streamValues),
  reason: z.string().max(500).optional(),
  portfolioReviewed: z.boolean().optional(),
});

export async function confirmPlacement(input: z.input<typeof confirmInput>): Promise<ActionResult> {
  if (!(await authorise(trainersAndAdmins))) {
    return { ok: false, error: notAllowed };
  }
  const parsed = confirmInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "The confirmation is not valid." };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("confirm_placement", {
    p_attempt_id: parsed.data.attemptId,
    p_stream: parsed.data.stream,
    p_reason: parsed.data.reason ?? undefined,
    p_portfolio_reviewed: parsed.data.portfolioReviewed ?? false,
  });
  if (error) {
    return { ok: false, error: databaseMessage(error, "Placement could not be confirmed.") };
  }
  revalidatePath("/trainer/placements");
  revalidatePath("/assessments");
  return { ok: true, data: null };
}

const retakeInput = z.strictObject({
  userId: z.uuid(),
  assessmentId: z.uuid(),
  reason: z.string().trim().min(10).max(500),
});

export async function allowAssessmentRetake(input: z.input<typeof retakeInput>): Promise<ActionResult> {
  if (!(await authorise(trainersAndAdmins))) {
    return { ok: false, error: notAllowed };
  }
  const parsed = retakeInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Give a reason of at least ten characters." };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("allow_retake", {
    p_user_id: parsed.data.userId,
    p_assessment_id: parsed.data.assessmentId,
    p_reason: parsed.data.reason,
  });
  if (error) {
    return { ok: false, error: databaseMessage(error, "Retake could not be allowed.") };
  }
  revalidatePath("/trainer/placements");
  return { ok: true, data: null };
}

export async function fetchQuizQuestionCheck(assessmentId: string): Promise<QuizQuestionCheckRow[]> {
  if (!(await authorise(trainersAndAdmins))) {
    return [];
  }
  if (!assessmentId) {
    return [];
  }
  return loadQuizQuestionCheck(assessmentId);
}
