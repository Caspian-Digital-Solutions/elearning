import type { ReactNode } from "react";
import { requireRole } from "@/lib/auth/require-role";

export default function AdminLayout({ children }: { children: ReactNode }) {
  requireRole(["admin"]);
  return children;
}
