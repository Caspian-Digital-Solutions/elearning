import type { ReactNode } from "react";
import type { AppRole } from "@/config/navigation";
import { requireRole } from "@/lib/auth";

/** Renders children only for the allowed roles; everyone else goes to /my-path. Use inside <Suspense>. */
export async function RoleGate({
  allowed,
  children,
}: {
  allowed: readonly AppRole[];
  children: ReactNode;
}) {
  await requireRole(allowed);
  return children;
}
