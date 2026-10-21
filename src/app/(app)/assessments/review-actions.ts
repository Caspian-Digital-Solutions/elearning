"use server";

import { authorise } from "@/lib/auth";
import { databaseMessage, notAllowed, type ActionResult } from "@/lib/actions/result";
import { createClient } from "@/lib/supabase/server";

export type AttemptReviewRow = {
  itemId: string;
  promptMd: string;
  chosenOptionId: string | null;
  chosenText: string | null;
  correctOptionId: string | null;
  correctText: string | null;
  explanationMd: string;
};

export async function loadAttemptReview(
  attemptId: string,
): Promise<ActionResult<AttemptReviewRow[]>> {
  if (!(await authorise(["learner", "champion", "manager", "trainer", "admin"]))) {
    return { ok: false, error: notAllowed };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_attempt_review", { p_attempt_id: attemptId });
  if (error) {
    return { ok: false, error: databaseMessage(error, "Review is not available for this attempt.") };
  }
  return {
    ok: true,
    data: (data ?? []).map((row) => ({
      itemId: row.item_id,
      promptMd: row.prompt_md,
      chosenOptionId: row.chosen_option_id,
      chosenText: row.chosen_text,
      correctOptionId: row.correct_option_id,
      correctText: row.correct_text,
      explanationMd: row.explanation_md,
    })),
  };
}
