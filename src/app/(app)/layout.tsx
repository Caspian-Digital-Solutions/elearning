import { Suspense, type ReactNode } from "react";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { PreLaunchRibbon } from "@/components/layout/pre-launch-ribbon";
import { AcknowledgementBanner } from "@/components/layout/acknowledgement-banner";
import { HideOnHelp } from "@/components/layout/hide-on-help";
import { noteLastSeen, requireUser } from "@/lib/auth";
import { countUnreadUpdates } from "@/lib/content/queries";
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
  const badges: Record<string, number> = {};
  if (user.role === "trainer" || user.role === "admin") {
    const pendingCount = await countSetupPending();
    if (pendingCount) {
      badges["/trainer/users"] = pendingCount;
    }
  }
  const unread = await countUnreadUpdates(user.id, user.updatesSeenAt);
  if (unread > 0) {
    badges["/what-changed"] = unread;
  }
  return (
    <>
      <PreLaunchRibbon user={user} />
      <AppShell user={user} badges={Object.keys(badges).length ? badges : undefined}>
      <HideOnHelp>
        <Suspense fallback={null}>
          <AcknowledgementBanner />
        </Suspense>
      </HideOnHelp>
      {children}
    </AppShell>
    </>
  );
}
