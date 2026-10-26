import "server-only";

import { isProductionAppEnv } from "@/lib/app-env";
import { readPublicEnv } from "@/lib/env-public";
import { projectRefFromSupabaseUrl } from "@/lib/supabase/project-ref";

/**
 * Production deployment still pointed at the development Supabase project
 * (no production cut-over yet).
 */
export function isPreLaunchDatabase(): boolean {
  if (!isProductionAppEnv()) {
    return false;
  }
  const { NEXT_PUBLIC_SUPABASE_URL } = readPublicEnv();
  const ref = projectRefFromSupabaseUrl(NEXT_PUBLIC_SUPABASE_URL);
  if (!ref) {
    return true;
  }
  const prodRef = process.env.SUPABASE_PROD_PROJECT_REF?.trim();
  if (prodRef && ref === prodRef) {
    return false;
  }
  const devRef = process.env.DEV_PROJECT_REF?.trim();
  if (devRef) {
    return ref === devRef;
  }
  return true;
}

export function preLaunchEnvironmentLabel(): string {
  return "pre-launch (development database)";
}
