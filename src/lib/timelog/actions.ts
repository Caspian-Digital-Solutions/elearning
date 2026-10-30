"use server";

import { revalidatePath } from "next/cache";
import { authorise } from "@/lib/auth";
import type { ActionResult } from "@/lib/actions/result";
import { databaseMessage } from "@/lib/actions/result";
import { createClient } from "@/lib/supabase/server";

export async function saveBaselineAction(
  taskId: string,
  minutes: number,
  basis: "measured" | "estimate",
): Promise<ActionResult> {
  const user = await authorise(["learner", "champion", "manager", "trainer", "admin"]);
  if (!user) {
    return { ok: false, error: "You must be signed in." };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("save_baseline", {
    p_task_id: taskId,
    p_minutes: minutes,
    p_basis: basis,
  });
  if (error) {
    return { ok: false, error: databaseMessage(error, "Could not save baseline.") };
  }
  revalidatePath("/progress");
  revalidatePath("/my-path");
  return { ok: true, data: null };
}

export async function saveTimeLogAction(input: {
  logId: string | null;
  taskId: string;
  loggedOn: string;
  minutes: number;
  outcome: "kept" | "edited_heavily" | "discarded";
  tools: ("claude" | "perplexity" | "chatgpt" | "other")[];
  skillId: string | null;
  promptId: string | null;
  note: string;
  declaration: boolean;
}): Promise<ActionResult<{ id: string }>> {
  const user = await authorise(["learner", "champion", "manager", "trainer", "admin"]);
  if (!user) {
    return { ok: false, error: "You must be signed in." };
  }
  const supabase = await createClient();
  const args = {
    p_log_id: input.logId,
    p_task_id: input.taskId,
    p_logged_on: input.loggedOn,
    p_minutes: input.minutes,
    p_outcome: input.outcome,
    p_tools: input.tools,
    p_skill_id: input.skillId,
    p_prompt_id: input.promptId,
    p_note: input.note,
    p_declaration: input.declaration,
  };
  const { data, error } = await supabase.rpc("save_time_log", args as never);
  if (error) {
    return { ok: false, error: databaseMessage(error, "Could not save time log.") };
  }
  revalidatePath("/progress");
  revalidatePath("/my-path");
  return { ok: true, data: { id: data as string } };
}
