import type { ReactNode } from "react";
import { requireRole } from "@/lib/auth/require-role";

export default function RestrictedTrainerLayout({ children }: { children: ReactNode }) {
  requireRole(["trainer", "admin"]);
  return children;
}
