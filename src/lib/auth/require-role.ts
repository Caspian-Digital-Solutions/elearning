import "server-only";

import { redirect } from "next/navigation";
import type { AppRole } from "@/config/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";

export function requireRole(allowed: readonly AppRole[]) {
  const user = getCurrentUser();
  if (!allowed.includes(user.role)) {
    redirect("/my-path");
  }
  return user;
}
