import { Suspense, type ReactNode } from "react";
import { RoleGate } from "@/components/auth/role-gate";

export default function RestrictedTrainerLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={null}>
      <RoleGate allowed={["trainer", "admin"]}>{children}</RoleGate>
    </Suspense>
  );
}
