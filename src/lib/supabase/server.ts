import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { cache } from "react";
import { readPublicEnv } from "@/lib/env";
import type { Database } from "@/lib/types/database";

/**
 * Supabase client for Server Components, Server Actions and Route Handlers.
 * Acts as the signed-in person, so RLS applies. One cached client per request.
 */
export const createClient = cache(async () => {
  // cookies() first: it marks the render as per-request, so builds never need the variables.
  const cookieStore = await cookies();
  const env = readPublicEnv();

  const supabase = createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Server Components cannot set cookies. proxy.ts (Prompt 03) refreshes the session instead.
          }
        },
      },
    },
  );

  // Initialise the session on this client before PostgREST calls (same pattern as proxy.ts).
  await supabase.auth.getClaims();

  return supabase;
});
