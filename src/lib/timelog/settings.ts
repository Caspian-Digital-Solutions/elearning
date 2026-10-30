import "server-only";

import { createClient } from "@/lib/supabase/server";

export async function timelogF7Required(): Promise<number> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("timelog_f7_required_logs");
  return typeof data === "number" ? data : 2;
}

export async function timelogMinGroupSize(): Promise<number> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("timelog_min_group_size");
  return typeof data === "number" ? data : 3;
}
