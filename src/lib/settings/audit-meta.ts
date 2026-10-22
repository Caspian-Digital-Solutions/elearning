import "server-only";

import { createClient } from "@/lib/supabase/server";

export type SettingAuditMeta = {
  changedAt: string;
  changedBy: string;
  reason: string | null;
};

/** Latest audit_log row per app_settings key (who, when, reason). */
export async function loadSettingsAuditMeta(keys: readonly string[]): Promise<Map<string, SettingAuditMeta>> {
  if (keys.length === 0) {
    return new Map();
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("audit_log")
    .select("at, actor_id, reason, before, after, action")
    .eq("table_name", "app_settings")
    .order("at", { ascending: false })
    .limit(1000);
  if (error) {
    throw new Error("Could not load settings audit history.");
  }

  const wanted = new Set(keys);
  const latest = new Map<string, { at: string; actor_id: string | null; reason: string | null; action: string }>();
  for (const row of data ?? []) {
    const record = (row.after ?? row.before) as { key?: string } | null;
    const key = record?.key;
    if (!key || !wanted.has(key) || latest.has(key)) {
      continue;
    }
    latest.set(key, {
      at: row.at,
      actor_id: row.actor_id,
      reason: row.reason,
      action: row.action,
    });
  }

  const actorIds = [...new Set(latest.values().map((row) => row.actor_id).filter(Boolean))] as string[];
  const names = new Map<string, string>();
  if (actorIds.length > 0) {
    const { data: people } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("id", actorIds);
    for (const person of people ?? []) {
      names.set(person.id, person.full_name?.trim() || person.email);
    }
  }

  const result = new Map<string, SettingAuditMeta>();
  for (const [key, row] of latest) {
    const changedBy =
      row.actor_id ? (names.get(row.actor_id) ?? "Removed person") : row.action === "insert" ? "System — migration" : "System";
    result.set(key, {
      changedAt: row.at,
      changedBy,
      reason: row.reason,
    });
  }
  return result;
}
