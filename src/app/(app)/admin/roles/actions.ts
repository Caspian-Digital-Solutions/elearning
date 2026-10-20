"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { authorise } from "@/lib/auth";
import { databaseMessage, notAllowed, type ActionResult } from "@/lib/actions/result";
import { appRoleValues, progressScopeValues } from "@/lib/people/labels";
import { createClient } from "@/lib/supabase/server";

const changeRoleInput = z.strictObject({
  userId: z.uuid({ error: "That person was not found." }),
  role: z.enum(appRoleValues, { error: "Choose a role." }),
  scope: z.enum(progressScopeValues, { error: "Choose a progress scope." }),
  reason: z
    .string()
    .trim()
    .min(10, { error: "Give a reason of at least 10 characters." })
    .max(500, { error: "Keep the reason under 500 characters." }),
});

export type ChangeRoleInput = z.input<typeof changeRoleInput>;

/** Admin only. The database also refuses to leave the platform without an active admin. */
export async function changeRole(input: ChangeRoleInput): Promise<ActionResult> {
  if (!(await authorise(["admin"]))) {
    return { ok: false, error: notAllowed };
  }
  const parsed = changeRoleInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  }
  const { userId, role, scope, reason } = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_role", {
    user_id: userId,
    new_role: role,
    new_scope: scope,
    reason,
  });
  if (error) {
    return { ok: false, error: databaseMessage(error, "The role was not changed. Try again.") };
  }
  revalidatePath("/", "layout");
  return { ok: true, data: null };
}
