/**
 * Shared safety checks for demo seed/clear scripts (dev project ref only).
 */

import { projectRefFromSupabaseUrl } from "../src/lib/supabase/project-ref";

export { projectRefFromSupabaseUrl };

export function assertDevProjectRef(
  databaseUrl: string,
  devProjectRef: string,
): { ok: true; ref: string } | { ok: false; message: string } {
  const ref = projectRefFromSupabaseUrl(databaseUrl);
  if (!ref) {
    return { ok: false, message: "Could not read a Supabase project ref from the database URL." };
  }
  const expected = devProjectRef.trim();
  if (!expected) {
    return { ok: false, message: "DEV_PROJECT_REF is missing in .env.local." };
  }
  if (ref !== expected) {
    return {
      ok: false,
      message: `Refusing to run: URL project ref is ${ref}, but DEV_PROJECT_REF is ${expected}.`,
    };
  }
  return { ok: true, ref };
}

export function readYesFromArgv(argv: readonly string[]): boolean {
  return argv.includes("--yes");
}

export function assertNotProductionAppEnv(): { ok: true } | { ok: false; message: string } {
  const appEnv = process.env.APP_ENV?.trim().toLowerCase();
  if (appEnv === "production") {
    return {
      ok: false,
      message: "Refusing to run: APP_ENV is production. Demo scripts are development-only.",
    };
  }
  return { ok: true };
}
