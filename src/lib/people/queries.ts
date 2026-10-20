import "server-only";

import { createClient } from "@/lib/supabase/server";

/**
 * Set-up pending means an active learner with no department: the people who
 * see "Your account is almost ready" until a trainer assigns one.
 * Row-level security limits the count to people the caller may see.
 */
export async function countSetupPending(): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("role", "learner")
    .eq("is_active", true)
    .is("department_id", null);
  return count ?? 0;
}
