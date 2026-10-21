"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { authorise } from "@/lib/auth";
import { databaseMessage, notAllowed, type ActionResult } from "@/lib/actions/result";
import { createClient } from "@/lib/supabase/server";

const trainersAndAdmins = ["trainer", "admin"] as const;

const discardInput = z.strictObject({
  attemptId: z.uuid(),
  reason: z
    .string()
    .trim()
    .min(10, { error: "Give a reason of at least ten characters." })
    .max(500, { error: "Keep the reason under 500 characters." }),
});

export async function discardSampleInProgressAttempt(
  input: z.input<typeof discardInput>,
): Promise<ActionResult> {
  if (!(await authorise(trainersAndAdmins))) {
    return { ok: false, error: notAllowed };
  }
  const parsed = discardInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("discard_sample_in_progress_attempt", {
    p_attempt_id: parsed.data.attemptId,
    p_reason: parsed.data.reason,
  });
  if (error) {
    return { ok: false, error: databaseMessage(error, "The attempt was not discarded. Try again.") };
  }
  revalidatePath("/trainer/placements");
  revalidatePath("/my-path");
  revalidatePath("/assessments");
  return { ok: true, data: null };
}
