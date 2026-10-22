"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { authorise } from "@/lib/auth";
import { databaseMessage, notAllowed, type ActionResult } from "@/lib/actions/result";
import { createClient } from "@/lib/supabase/server";

const leaverInput = z.strictObject({
  userId: z.uuid(),
  reason: z.string().min(10).max(500),
});

export async function markPersonAsLeaver(input: z.input<typeof leaverInput>): Promise<ActionResult> {
  if (!(await authorise(["admin"]))) {
    return { ok: false, error: notAllowed };
  }
  const parsed = leaverInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "A reason of at least 10 characters is required." };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_mark_leaver", {
    p_user_id: parsed.data.userId,
    p_reason: parsed.data.reason,
  });
  if (error) {
    return { ok: false, error: databaseMessage(error, "This person could not be marked as a leaver.") };
  }
  revalidatePath("/admin/people");
  revalidatePath("/admin/retention");
  revalidatePath("/admin/roles");
  return { ok: true, data: null };
}

export async function recordPersonalDataExport(userId: string, reason: string): Promise<ActionResult> {
  if (!(await authorise(["admin"]))) {
    return { ok: false, error: notAllowed };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_log_event", {
    p_table_name: "profiles",
    p_row_id: userId,
    p_reason: reason,
    p_event: "personal_data_export",
  });
  if (error) {
    return { ok: false, error: databaseMessage(error, "The export could not be recorded in the audit log.") };
  }
  return { ok: true, data: null };
}
