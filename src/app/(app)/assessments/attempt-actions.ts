"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { authorise } from "@/lib/auth";
import { databaseMessage, notAllowed, type ActionResult } from "@/lib/actions/result";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/types/database";

const saveResponseInput = z.strictObject({
  attemptId: z.uuid(),
  itemId: z.uuid(),
  answer: z.record(z.string(), z.json()),
});

export async function startAssessmentAttempt(assessmentId: string): Promise<ActionResult<{ attemptId: string }>> {
  if (!(await authorise(["learner", "champion", "manager", "trainer", "admin"]))) {
    return { ok: false, error: notAllowed };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("start_attempt", { p_assessment_id: assessmentId });
  if (error || !data) {
    return { ok: false, error: databaseMessage(error, "The attempt could not be started.") };
  }
  return { ok: true, data: { attemptId: data.id } };
}

export async function saveAssessmentResponse(
  input: z.input<typeof saveResponseInput>,
): Promise<ActionResult> {
  if (!(await authorise(["learner", "champion", "manager", "trainer", "admin"]))) {
    return { ok: false, error: notAllowed };
  }
  const parsed = saveResponseInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "The answer could not be saved." };
  }
  const supabase = await createClient();
  const { error } = await supabase.from("responses").upsert(
    {
      attempt_id: parsed.data.attemptId,
      item_id: parsed.data.itemId,
      answer: parsed.data.answer as NonNullable<Json>,
    },
    { onConflict: "attempt_id,item_id" },
  );
  if (error) {
    return { ok: false, error: databaseMessage(error, "The answer could not be saved.") };
  }
  return { ok: true, data: null };
}

export async function submitAssessmentAttempt(input: {
  attemptId: string;
  dataDeclaration: boolean;
  code: string;
}): Promise<ActionResult> {
  if (!(await authorise(["learner", "champion", "manager", "trainer", "admin"]))) {
    return { ok: false, error: notAllowed };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_attempt", {
    p_attempt_id: input.attemptId,
    p_data_declaration: input.dataDeclaration,
  });
  if (error) {
    return { ok: false, error: databaseMessage(error, "The attempt could not be submitted.") };
  }
  revalidatePath("/assessments");
  revalidatePath(`/assessments/${input.code}`);
  return { ok: true, data: null };
}

export async function updateAttemptSeconds(input: {
  attemptId: string;
  secondsActive: number;
}): Promise<ActionResult> {
  if (!(await authorise(["learner", "champion", "manager", "trainer", "admin"]))) {
    return { ok: false, error: notAllowed };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("attempts")
    .update({ seconds_active: Math.max(0, Math.floor(input.secondsActive)) })
    .eq("id", input.attemptId)
    .eq("status", "in_progress");
  if (error) {
    return { ok: false, error: databaseMessage(error, "Time could not be saved.") };
  }
  return { ok: true, data: null };
}
