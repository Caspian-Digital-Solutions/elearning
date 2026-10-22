/**
 * Shared safety checks for demo seed/clear scripts (dev project ref only).
 */

export function projectRefFromSupabaseUrl(url: string): string | null {
  try {
    const host = new URL(url).hostname;
    const match = /^([a-z0-9]+)\.supabase\.co$/i.exec(host);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

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
