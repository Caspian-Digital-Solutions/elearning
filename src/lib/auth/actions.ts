"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/** Ends the session and returns to /login. Safe to call when already signed out. */
export async function signOut(): Promise<void> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (data?.claims?.sub) {
    await supabase.auth.signOut();
  }
  redirect("/login");
}
