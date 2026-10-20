"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { signInErrorMessage } from "@/lib/auth/sign-in-errors";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

/** Google is only a hint here (hd); the database refuses any other domain. */
const cdsGoogleDomain = "caspiands.com";

export function LoginForm() {
  const searchParams = useSearchParams();
  const [pending, setPending] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const message = startError ?? signInErrorMessage(searchParams.get("error"));

  async function signIn() {
    setPending(true);
    setStartError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: { hd: cdsGoogleDomain, prompt: "select_account" },
      },
    });
    if (error) {
      setPending(false);
      setStartError(signInErrorMessage("failed"));
    }
  }

  return (
    <div className="space-y-3">
      {message ? (
        <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {message}
        </p>
      ) : null}
      <Button type="button" className="w-full" onClick={signIn} disabled={pending}>
        {pending ? "Opening Google…" : "Sign in with Google"}
      </Button>
    </div>
  );
}
