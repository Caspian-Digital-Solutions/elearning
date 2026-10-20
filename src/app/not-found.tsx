import Link from "next/link";
import { CentredFrame } from "@/components/shared/centred-frame";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function NotFound() {
  return (
    <CentredFrame>
      <Card>
        <CardHeader>
          <h1 className="text-2xl">That page does not exist</h1>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>Check the address, or go back to My path.</p>
          <Button render={<Link href="/my-path" />}>Back to My path</Button>
        </CardContent>
      </Card>
    </CentredFrame>
  );
}
