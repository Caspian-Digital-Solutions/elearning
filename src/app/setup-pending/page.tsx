import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Logo } from "@/components/shared/logo";
import { CentredFrame } from "@/components/shared/centred-frame";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { requireUser } from "@/lib/auth";
import { signOut } from "@/lib/auth/actions";

export const metadata: Metadata = {
  title: "Account setup",
};

export default function SetupPendingPage() {
  return (
    <CentredFrame>
      <Card>
        <CardHeader className="items-center">
          <Logo />
        </CardHeader>
        <CardContent className="space-y-3">
          <h1 className="text-2xl">Account setup</h1>
          <p>
            Your account is almost ready. A trainer will assign your department; you will then see
            your learning path. Questions: contact Mahgol.
          </p>
          <Suspense fallback={<p className="text-sm text-muted-foreground">Checking your account…</p>}>
            <SignedInAs />
          </Suspense>
        </CardContent>
      </Card>
    </CentredFrame>
  );
}

async function SignedInAs() {
  const user = await requireUser();
  if (user.actualRole !== "learner" || user.departmentId) {
    redirect("/my-path");
  }
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Signed in as <span className="text-foreground">{user.email}</span>
      </p>
      <form action={signOut}>
        <Button type="submit" variant="outline">
          Sign out
        </Button>
      </form>
    </div>
  );
}
