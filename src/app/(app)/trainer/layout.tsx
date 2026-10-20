import { Suspense, type ReactNode } from "react";
import { RoleGate } from "@/components/auth/role-gate";

// Champions get in here only for /trainer/marking; the (restricted) group keeps them out of the rest.
export default function TrainerLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={null}>
      <RoleGate allowed={["trainer", "admin", "champion"]}>{children}</RoleGate>
    </Suspense>
  );
}
