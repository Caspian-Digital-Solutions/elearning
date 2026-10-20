import type { Metadata } from "next";
import { Logo } from "@/components/shared/logo";
import { CentredFrame } from "@/components/shared/centred-frame";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

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
        </CardContent>
      </Card>
    </CentredFrame>
  );
}
