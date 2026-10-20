/**
 * Sign-in problems are passed to /login as a short code, never as raw provider
 * text, so nothing from the URL is shown on the page unchecked.
 */

export const signInErrorMessages = {
  "wrong-domain": "Please sign in with your CDS Google account.",
  "not-completed": "Google did not finish signing you in. Try again with your CDS Google account.",
  "no-access": "Your account is not active. Contact Mahgol if you think this is wrong.",
  failed: "Sign-in did not work. Try again. If it keeps happening, contact Mahgol.",
} as const;

export type SignInErrorCode = keyof typeof signInErrorMessages;

export function isSignInErrorCode(value: string | null | undefined): value is SignInErrorCode {
  return value !== null && value !== undefined && Object.hasOwn(signInErrorMessages, value);
}

export function signInErrorMessage(code: string | null | undefined): string | null {
  return isSignInErrorCode(code) ? signInErrorMessages[code] : null;
}

/**
 * Supabase and Google report failures as `error` / `error_description` query
 * parameters on the callback URL. A refusal by the domain hook or the
 * handle_new_user trigger arrives here too.
 */
export function classifyCallbackError(params: URLSearchParams): SignInErrorCode | null {
  const error = params.get("error");
  const description = params.get("error_description") ?? "";
  if (!error && !description) return null;

  if (/CDS Google account|saving new user|creating new user/i.test(description)) {
    return "wrong-domain";
  }
  if (error === "access_denied") {
    return "not-completed";
  }
  return "failed";
}
