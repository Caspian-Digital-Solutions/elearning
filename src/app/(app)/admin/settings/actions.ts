"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { authorise } from "@/lib/auth";
import { databaseMessage, notAllowed, type ActionResult } from "@/lib/actions/result";
import { checkReason, checkSetting } from "@/lib/settings/validators";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/types/database";

const saveSettingInput = z.strictObject({
  key: z.string().min(1).max(200),
  value: z.json(),
  reason: z.string(),
});

export type SaveSettingInput = z.input<typeof saveSettingInput>;

/** Admin only. Checks the new value against the other saved settings, then saves it with the reason. */
export async function saveSetting(input: SaveSettingInput): Promise<ActionResult> {
  if (!(await authorise(["admin"]))) {
    return { ok: false, error: notAllowed };
  }
  const parsed = saveSettingInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "The new value is not valid JSON." };
  }
  const reason = checkReason(parsed.data.reason);
  if (!reason.ok) {
    return { ok: false, error: reason.errors.join(" ") };
  }

  const supabase = await createClient();
  const { data: rows, error: readError } = await supabase.from("app_settings").select("key, value");
  if (readError) {
    return { ok: false, error: "The settings could not be read. Try again." };
  }
  if (!rows.some((row) => row.key === parsed.data.key)) {
    return { ok: false, error: "That setting does not exist." };
  }
  const current = Object.fromEntries(rows.map((row) => [row.key, row.value]));
  let moduleCodes: string[] | undefined;
  if (parsed.data.key === "placement.bridge_modules") {
    const { data: modules } = await supabase.from("modules").select("code");
    moduleCodes = (modules ?? []).map((row) => row.code);
  }
  const check = checkSetting(parsed.data.key, parsed.data.value, current, moduleCodes);
  if (!check.ok) {
    return { ok: false, error: check.errors.join(" ") };
  }

  const { error } = await supabase.rpc("admin_update_setting", {
    key: parsed.data.key,
    new_value: check.value as Json,
    reason: reason.value,
  });
  if (error) {
    return { ok: false, error: databaseMessage(error, "The setting was not saved. Try again.") };
  }
  revalidatePath("/admin/settings");
  return { ok: true, data: null };
}
