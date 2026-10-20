import { createBrowserClient } from "@supabase/ssr";
import { readPublicEnv } from "@/lib/env-public";
import type { Database } from "@/lib/types/database";

/** Supabase client for Client Components. Uses the publishable key; RLS decides what it can see. */
export function createClient() {
  const env = readPublicEnv();
  return createBrowserClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}
