"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { authorise } from "@/lib/auth";
import { databaseMessage, notAllowed, type ActionResult } from "@/lib/actions/result";
import { loadTrainerPlanForUser } from "@/lib/plan/queries";
import type { PlanStatus } from "@/lib/plan/types";
import { createClient } from "@/lib/supabase/server";

const trainersAndAdmins = ["trainer", "admin"] as const;

const planStatuses = [
  "required",
  "optional",
  "tested_out",
  "bridge",
  "not_applicable",
] as const satisfies readonly PlanStatus[];

const overrideInput = z.strictObject({
  userId: z.uuid(),
  moduleId: z.uuid(),
  status: z.enum(planStatuses),
  reason: z
    .string()
    .trim()
    .min(10, { error: "Give a reason of at least ten characters." })
    .max(500, { error: "Keep the reason under 500 characters." }),
});

export async function fetchTrainerPlan(userId: string) {
  if (!(await authorise(trainersAndAdmins))) {
    return null;
  }
  return loadTrainerPlanForUser(userId);
}

export async function rebuildLearnerPlan(userId: string): Promise<ActionResult<{ rows: number }>> {
  if (!(await authorise(trainersAndAdmins))) {
    return { ok: false, error: notAllowed };
  }
  const parsedId = z.uuid().safeParse(userId);
  if (!parsedId.success) {
    return { ok: false, error: "That person was not found." };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("generate_learner_plan", { p_user_id: parsedId.data });
  if (error) {
    return { ok: false, error: databaseMessage(error, "The plan was not rebuilt. Try again.") };
  }
  revalidatePath("/my-path");
  revalidatePath("/trainer/users");
  return { ok: true, data: { rows: data ?? 0 } };
}

export async function overridePlanItem(input: z.input<typeof overrideInput>): Promise<ActionResult> {
  if (!(await authorise(trainersAndAdmins))) {
    return { ok: false, error: notAllowed };
  }
  const parsed = overrideInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("override_plan_item", {
    p_user_id: parsed.data.userId,
    p_module_id: parsed.data.moduleId,
    p_status: parsed.data.status,
    p_reason: parsed.data.reason,
  });
  if (error) {
    return { ok: false, error: databaseMessage(error, "The plan row was not changed. Try again.") };
  }
  revalidatePath("/my-path");
  revalidatePath("/trainer/users");
  return { ok: true, data: null };
}
