import "server-only";

import { createClient } from "@supabase/supabase-js";
import { readServerEnv } from "@/lib/env";
import type { Database } from "@/lib/types/database";

/**
 * Secret-key client. It bypasses row-level security, so use it only for
 * trusted server jobs that no signed-in person could do through RLS
 * (for example, counting seed rows before anyone can sign in).
 * Every caller must say in a comment why it needs this client.
 */
export function createAdminClient() {
  const env = readServerEnv();
  return createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
