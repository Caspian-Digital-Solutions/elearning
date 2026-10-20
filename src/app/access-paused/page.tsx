import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CentredFrame } from "@/components/shared/centred-frame";
import { Logo } from "@/components/shared/logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { signOut } from "@/lib/auth/actions";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Access paused",
};

export default function AccessPausedPage() {
  return (
    <CentredFrame>
      <Card>
        <CardHeader className="items-center">
          <Logo />
        </CardHeader>
        <CardContent className="space-y-3">
          <h1 className="text-2xl">Access paused</h1>
          <p>Your access is paused. Contact Mahgol or Bharg.</p>
          <Suspense fallback={<p className="text-sm text-muted-foreground">Checking your account…</p>}>
            <PausedAccount />
          </Suspense>
        </CardContent>
      </Card>
    </CentredFrame>
  );
}

async function PausedAccount() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) {
    redirect("/login");
  }
  const { data: status } = await supabase.rpc("my_access_status");
  if (status !== "paused") {
    redirect("/my-path");
  }
  const email = typeof claims.email === "string" ? claims.email : null;

  return (
    <div className="space-y-3">
      {email ? (
        <p className="text-sm text-muted-foreground">
          Signed in as <span className="text-foreground">{email}</span>
        </p>
      ) : null}
      <form action={signOut}>
        <Button type="submit" variant="outline">
          Sign out
        </Button>
      </form>
    </div>
  );
}
