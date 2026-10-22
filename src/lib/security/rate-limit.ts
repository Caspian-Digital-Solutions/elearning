import "server-only";

import { createClient } from "@/lib/supabase/server";

export type RateLimitAction =
  | "auth.callback"
  | "assessment.submit"
  | "assessment.save"
  | "assignment.submit"
  | "assignment.upload";

const limits: Record<
  RateLimitAction,
  { windowSeconds: number; maxEvents: number; message: string }
> = {
  "auth.callback": {
    windowSeconds: 15 * 60,
    maxEvents: 30,
    message: "Too many sign-in attempts. Wait a few minutes and try again.",
  },
  "assessment.submit": {
    windowSeconds: 60,
    maxEvents: 6,
    message: "You are submitting answers too quickly. Wait a moment and try again.",
  },
  "assessment.save": {
    windowSeconds: 60,
    maxEvents: 40,
    message: "You are saving too quickly. Wait a moment and try again.",
  },
  "assignment.submit": {
    windowSeconds: 60,
    maxEvents: 6,
    message: "You are handing in work too quickly. Wait a moment and try again.",
  },
  "assignment.upload": {
    windowSeconds: 60,
    maxEvents: 15,
    message: "You are uploading files too quickly. Wait a moment and try again.",
  },
};

export function rateLimitMessage(action: RateLimitAction): string {
  return limits[action].message;
}

/** Returns an error message when limited, or null when allowed. */
export async function enforceRateLimit(
  action: RateLimitAction,
  bucketKey: string,
): Promise<string | null> {
  const rule = limits[action];
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("check_rate_limit", {
    p_action_key: action,
    p_bucket_key: bucketKey,
    p_window_seconds: rule.windowSeconds,
    p_max_events: rule.maxEvents,
  });
  if (error) {
    console.error("[rate-limit] check failed", { action, code: error.code, message: error.message });
    return null;
  }
  if (data === false) {
    return rule.message;
  }
  return null;
}

export function clientIpBucket(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return `ip:${forwarded.split(",")[0]?.trim() ?? "unknown"}`;
  }
  return "ip:unknown";
}
