import { NextResponse, type NextRequest } from "next/server";
import { classifyCallbackError, type SignInErrorCode } from "@/lib/auth/sign-in-errors";
import { createClient } from "@/lib/supabase/server";

/**
 * Google returns here (through Supabase) after sign-in. Exchanges the one-time
 * code for a session cookie, then confirms the session before going to My path.
 * Any failure goes back to /login with a short error code.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);

  const providerError = classifyCallbackError(url.searchParams);
  if (providerError) {
    return toLogin(url, providerError);
  }

  const code = url.searchParams.get("code");
  if (!code) {
    return toLogin(url, "failed");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return toLogin(url, /CDS Google account|saving new user/i.test(error.message) ? "wrong-domain" : "failed");
  }

  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) {
    return toLogin(url, "failed");
  }

  return NextResponse.redirect(new URL("/my-path", url.origin));
}

function toLogin(url: URL, code: SignInErrorCode) {
  const target = new URL("/login", url.origin);
  target.searchParams.set("error", code);
  return NextResponse.redirect(target);
}
