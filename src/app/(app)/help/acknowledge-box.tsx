"use client";

import { useState } from "react";
import { toast } from "sonner";
import { confirmHelpPage } from "@/app/(app)/trainer/(restricted)/content/actions";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";

export function AcknowledgeBox({
  pageId,
  pageTitle,
  version,
  label,
  acknowledgedAt,
}: {
  pageId: string;
  pageTitle: string;
  version: number;
  label: string;
  acknowledgedAt: string | null;
}) {
  const [confirmedAt, setConfirmedAt] = useState(acknowledgedAt);
  const [pending, setPending] = useState(false);

  if (confirmedAt) {
    return (
      <p className="rounded-lg border border-border bg-surface p-4 text-sm">
        You confirmed version {version} on {formatDate(confirmedAt)}.
      </p>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <p className="mb-3 text-sm">{label}</p>
      <p className="mb-3 text-xs text-muted-foreground">Confirm you have read {pageTitle}.</p>
      <Button
        type="button"
        disabled={pending}
        onClick={() => {
          setPending(true);
          void confirmHelpPage(pageId, version).then((result) => {
            setPending(false);
            if (result.ok) {
              setConfirmedAt(new Date().toISOString());
              toast.success("Confirmation saved.");
            } else {
              toast.error(result.error);
            }
          });
        }}
      >
        Confirm
      </Button>
    </div>
  );
}
