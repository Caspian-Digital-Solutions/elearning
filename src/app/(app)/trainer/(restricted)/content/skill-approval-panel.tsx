"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { decideSkillApprovalAction } from "@/lib/skills/actions";
import type { SkillApprovalQueueItem } from "@/lib/skills/queries";

export function SkillApprovalPanel({ items }: { items: SkillApprovalQueueItem[] }) {
  if (!items.length) {
    return <p className="text-sm text-muted-foreground">Nothing waiting for approval.</p>;
  }

  return (
    <ul className="space-y-4">
      {items.map((item) => (
        <li key={item.versionId} className="rounded-md border border-border p-4 space-y-3">
          <div>
            <p className="font-medium">{item.displayName}</p>
            <p className="text-sm text-muted-foreground">
              Version {item.version} · {item.testSummary}
            </p>
          </div>
          <details className="text-sm">
            <summary className="cursor-pointer font-medium">Instructions text</summary>
            <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded bg-muted p-2 text-xs">
              {item.skillMdText || "(empty)"}
            </pre>
          </details>
          <ApprovalForm versionId={item.versionId} />
        </li>
      ))}
    </ul>
  );
}

function ApprovalForm({ versionId }: { versionId: string }) {
  const [comment, setComment] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = (decision: "approved" | "changes_requested") => {
    setPending(true);
    setError(null);
    void decideSkillApprovalAction({ versionId, decision, commentMd: comment }).then((result) => {
      setPending(false);
      if (result.ok) {
        window.location.reload();
      } else {
        setError(result.error);
      }
    });
  };

  return (
    <div className="space-y-2">
      <div className="space-y-1.5">
        <Label htmlFor={`comment-${versionId}`}>Comment</Label>
        <Textarea
          id={`comment-${versionId}`}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={3}
          placeholder="What you checked and any changes needed."
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" disabled={pending} onClick={() => submit("approved")}>
          Approve
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => submit("changes_requested")}>
          Request changes
        </Button>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
