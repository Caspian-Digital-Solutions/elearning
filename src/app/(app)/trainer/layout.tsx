import type { ReactNode } from "react";
import { requireRole } from "@/lib/auth/require-role";

export default function TrainerLayout({ children }: { children: ReactNode }) {
  requireRole(["trainer", "admin", "champion"]);
  return children;
}
