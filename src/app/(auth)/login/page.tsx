import type { Metadata } from "next";
import { Logo } from "@/components/shared/logo";
import { CentredFrame } from "@/components/shared/centred-frame";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

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
          <p>Sign in with your CDS Google account</p>
          <Button
            type="button"
            disabled
            className="w-full"
            aria-describedby="signin-availability"
          >
            Sign in with Google
          </Button>
          <p id="signin-availability" className="text-sm text-muted-foreground">
            Available after Prompt 03
          </p>
        </CardContent>
      </Card>
    </CentredFrame>
  );
}
