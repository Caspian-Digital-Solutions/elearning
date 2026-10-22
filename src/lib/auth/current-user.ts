import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { after, connection } from "next/server";
import type { AppRole } from "@/config/navigation";
import { readDevPreviewRole } from "@/lib/env";
import { blockTestAccountInProduction } from "@/lib/security/production-content";
import { createClient } from "@/lib/supabase/server";
import type { CurrentUser } from "@/lib/auth/types";

const lastSeenInterval = 60 * 60 * 1000;

/**
 * The signed-in person and their profile, or null when signed out, when the
 * profile is missing, or when it is inactive. Checked with getClaims(), which
 * verifies the session token; getSession() is never trusted for this.
 * Cached per request, so layouts and pages share one lookup.
 * Reads cookies, so callers must sit inside a <Suspense> boundary.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  await connection();
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (claimsError || !userId) {
    return null;
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select(
      "id, email, full_name, role, progress_scope, department_id, stream, is_active, is_test_account, last_seen_at, updates_seen_at, departments ( name )",
    )
    .eq("id", userId)
    .maybeSingle();

  if (error || !profile || !profile.is_active) {
    return null;
  }

  if (blockTestAccountInProduction(profile.is_test_account)) {
    return null;
  }

  const actualRole = profile.role;
  const role = previewRole(actualRole);

  return {
    id: profile.id,
    email: profile.email,
    fullName: profile.full_name?.trim() || profile.email,
    role,
    actualRole,
    isPreviewingRole: role !== actualRole,
    progressScope: profile.progress_scope,
    departmentId: profile.department_id,
    departmentName: profile.departments?.name ?? null,
    stream: profile.stream,
    lastSeenAt: profile.last_seen_at,
    updatesSeenAt: profile.updates_seen_at,
  };
});

/**
 * DEV_PREVIEW_ROLE lets an admin see another role's menus on their own laptop.
 * It never applies in production builds or to anyone who is not an admin, and
 * it does not change what the database allows.
 */
function previewRole(actualRole: AppRole): AppRole {
  if (process.env.NODE_ENV !== "development" || actualRole !== "admin") {
    return actualRole;
  }
  return readDevPreviewRole() ?? actualRole;
}

/** Signed-in, active person; otherwise a redirect to /login or, for a paused account, /access-paused. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) {
    const supabase = await createClient();
    const { data } = await supabase.auth.getClaims();
    if (!data?.claims?.sub) {
      redirect("/login");
    }
    const { data: status } = await supabase.rpc("my_access_status");
    redirect(status === "paused" ? "/access-paused" : "/login?error=no-access");
  }
  return user;
}

/** Signed-in person with one of the allowed roles, or a redirect to /my-path. */
export async function requireRole(allowed: readonly AppRole[]): Promise<CurrentUser> {
  const user = await requireUser();
  if (!allowed.includes(user.role)) {
    redirect("/my-path");
  }
  return user;
}

/**
 * For Server Actions and Route Handlers: the signed-in, active person if their
 * real role (never a preview role) is allowed, otherwise null. The database
 * checks again with row-level security.
 */
export async function authorise(allowed: readonly AppRole[]): Promise<CurrentUser | null> {
  const user = await getCurrentUser();
  return user && allowed.includes(user.actualRole) ? user : null;
}

/** Records the page visit after the response is sent, at most once an hour. */
export async function noteLastSeen(user: CurrentUser): Promise<void> {
  const last = user.lastSeenAt ? Date.parse(user.lastSeenAt) : 0;
  if (Date.now() - last < lastSeenInterval) {
    return;
  }
  const supabase = await createClient();
  after(async () => {
    await supabase.rpc("record_last_seen");
  });
}
