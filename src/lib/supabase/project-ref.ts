/** Supabase project ref (subdomain) from a project API URL. */
export function projectRefFromSupabaseUrl(url: string): string | null {
  try {
    const host = new URL(url).hostname;
    const match = /^([a-z0-9]+)\.supabase\.co$/i.exec(host);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}
