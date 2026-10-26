import "server-only";

import { readAppEnv, isProductionAppEnv } from "@/lib/app-env";
import { projectRefFromSupabaseUrl } from "@/lib/supabase/project-ref";
import { readServerEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

export type PlatformInfo = {
  environment: string;
  projectRef: string;
  projectRefShort: string;
  gitCommit: string;
  latestMigration: string;
  sampleContentAllowed: boolean;
};

function shortRef(ref: string): string {
  return ref.length > 8 ? ref.slice(-8) : ref;
}

export async function loadPlatformInfo(): Promise<PlatformInfo> {
  const env = readServerEnv();
  const ref = projectRefFromSupabaseUrl(env.NEXT_PUBLIC_SUPABASE_URL) ?? "unknown";
  const gitCommit =
    process.env.VERCEL_GIT_COMMIT_SHA?.trim() ||
    process.env.GIT_COMMIT_SHA?.trim() ||
    "local";

  let latestMigration = "unknown";
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("platform_migration_head");
    if (!error && typeof data === "string") {
      latestMigration = data;
    }
  } catch {
    // Migration RPC may not be applied yet on this database.
  }

  return {
    environment: readAppEnv(),
    projectRef: ref,
    projectRefShort: shortRef(ref),
    gitCommit,
    latestMigration,
    sampleContentAllowed: !isProductionAppEnv(),
  };
}
