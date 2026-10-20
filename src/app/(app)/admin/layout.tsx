import { Suspense, type ReactNode } from "react";
import { RoleGate } from "@/components/auth/role-gate";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={null}>
      <RoleGate allowed={["admin"]}>{children}</RoleGate>
    </Suspense>
  );
}
