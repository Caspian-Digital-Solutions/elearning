"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4">
      <div id="main" className="w-full max-w-md rounded-xl bg-card p-6 ring-1 ring-border">
        <h1 className="text-2xl">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Try again. If it keeps happening, go back to My path.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" onClick={() => retry()}>
            Try again
          </Button>
          <Button variant="outline" render={<Link href="/my-path" />}>
            Back to My path
          </Button>
        </div>
      </div>
    </div>
  );
}
