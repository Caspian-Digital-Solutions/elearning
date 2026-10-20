import { Suspense, type ReactNode } from "react";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { noteLastSeen, requireUser } from "@/lib/auth";
import { countSetupPending } from "@/lib/people/queries";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-background" aria-busy="true" />}>
      <SignedInShell>{children}</SignedInShell>
    </Suspense>
  );
}

async function SignedInShell({ children }: { children: ReactNode }) {
  const user = await requireUser();
  if (user.actualRole === "learner" && !user.departmentId) {
    redirect("/setup-pending");
  }
  await noteLastSeen(user);
  const pendingCount =
    user.role === "trainer" || user.role === "admin" ? await countSetupPending() : undefined;
  return (
    <AppShell user={user} badges={pendingCount ? { "/trainer/users": pendingCount } : undefined}>
      {children}
    </AppShell>
  );
}
