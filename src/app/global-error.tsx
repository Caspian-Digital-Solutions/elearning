"use client";

import { useEffect } from "react";
import { fontVariables } from "@/lib/fonts";
import "./globals.css";

export default function GlobalError({
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
    <html lang="en-GB" className={fontVariables}>
      <body className="flex min-h-dvh items-center justify-center bg-background px-4 text-foreground">
        <div id="main" className="w-full max-w-md rounded-xl bg-card p-6 ring-1 ring-border">
          <h1 className="text-2xl text-heading">Something went wrong</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Try again. If it keeps happening, reload the page.
          </p>
          <button
            type="button"
            className="mt-4 rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground"
            onClick={() => retry()}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
