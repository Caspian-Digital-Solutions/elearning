import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { DatabaseWithAssignments } from "@/lib/types/database-assignments";

export async function createAssignmentsClient(): Promise<SupabaseClient<DatabaseWithAssignments>> {
  return (await createClient()) as SupabaseClient<DatabaseWithAssignments>;
}
