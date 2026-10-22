import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { authorise } from "@/lib/auth";
import type { Json } from "@/lib/settings/validators";
import { loadSettingsAuditMeta } from "@/lib/settings/audit-meta";
import { createClient } from "@/lib/supabase/server";
import { SettingsScreen, type SettingRecord } from "./settings-screen";

export const metadata: Metadata = {
  title: "Settings",
};

export default function Page() {
  return (
    <>
      <PageHeader
        title="Settings"
        purpose="Programme rules that are still under approval. Every change needs a reason, shows a before and after preview, and is recorded in the audit log."
      />
      <Suspense fallback={<Skeleton className="h-96" aria-busy="true" aria-label="Loading settings" />}>
        <SettingsData />
      </Suspense>
    </>
  );
}

async function SettingsData() {
  if (!(await authorise(["admin"]))) {
    return null;
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("app_settings")
    .select("key, value, note, updated_at, profiles ( full_name, email )")
    .order("key");
  if (error) {
    throw new Error("Could not load settings.");
  }
  const keys = data.map((row) => row.key);
  const auditByKey = await loadSettingsAuditMeta(keys);
  const settings: SettingRecord[] = data.map((row) => {
    const audit = auditByKey.get(row.key);
    return {
      key: row.key,
      // Values read back from jsonb never hold undefined, which the generated type allows.
      value: row.value as Json,
      note: row.note,
      updatedAt: audit?.changedAt ?? row.updated_at,
      updatedBy: audit?.changedBy ?? (row.profiles ? row.profiles.full_name?.trim() || row.profiles.email : null),
      auditReason: audit?.reason ?? null,
    };
  });
  const { data: modules } = await supabase.from("modules").select("code").order("code");
  const moduleCodes = (modules ?? []).map((row) => row.code);
  return <SettingsScreen settings={settings} moduleCodes={moduleCodes} />;
}
