import { Suspense } from "react";
import type { Metadata } from "next";
import { Logo } from "@/components/shared/logo";
import { CentredFrame } from "@/components/shared/centred-frame";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Sign in",
};

export default function LoginPage() {
  return (
    <CentredFrame>
      <Card>
        <CardHeader className="items-center">
          <Logo />
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          <h1 className="text-2xl">Sign in</h1>
          <p>Sign in with your CDS Google account to open the AI Academy.</p>
          <Suspense
            fallback={
              <Button type="button" className="w-full" disabled>
                Sign in with Google
              </Button>
            }
          >
            <LoginForm />
          </Suspense>
        </CardContent>
      </Card>
    </CentredFrame>
  );
}
