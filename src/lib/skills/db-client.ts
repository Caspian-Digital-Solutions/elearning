import type { SupabaseClient } from "@supabase/supabase-js";

/** Loosen types until `npm run db:types` includes Prompt 13 tables. */
export function skillsCatalogueClient(client: SupabaseClient) {
  return client as SupabaseClient;
}
