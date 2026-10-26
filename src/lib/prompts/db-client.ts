import type { SupabaseClient } from "@supabase/supabase-js";

/** Loosen types until `npm run db:types` includes Prompt 12 tables. */
export function promptLibraryClient(client: SupabaseClient) {
  return client as SupabaseClient;
}
