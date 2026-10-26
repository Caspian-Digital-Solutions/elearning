"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  markPromptTested,
  returnPromptWithComments,
  retirePrompt,
} from "@/app/(app)/trainer/(restricted)/content/prompt-actions";

export function PromptReviewPanel({
  items,
}: {
  items: {
    id: string;
    title: string;
    submit_notes_md: string | null;
    submitter: { full_name: string | null } | null;
  }[];
}) {
  const [pending, startTransition] = useTransition();
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [tasks, setTasks] = useState<Record<string, string>>({});

  if (!items.length) {
    return <p className="text-sm text-muted-foreground">No prompts waiting for review.</p>;
  }

  return (
    <ul className="space-y-4">
      {items.map((item) => (
        <li key={item.id} className="rounded-lg border border-border p-4">
          <p className="font-medium text-heading">{item.title}</p>
          <p className="text-sm text-muted-foreground">
            Submitted by {item.submitter?.full_name ?? "Someone"}
            {item.submit_notes_md ? ` — ${item.submit_notes_md}` : ""}
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor={`test-notes-${item.id}`}>Test notes (mark as tested)</Label>
              <Textarea
                id={`test-notes-${item.id}`}
                rows={2}
                value={notes[item.id] ?? ""}
                onChange={(event) => setNotes((current) => ({ ...current, [item.id]: event.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`tasks-${item.id}`}>Sample tasks tried (min 3)</Label>
              <input
                id={`tasks-${item.id}`}
                type="number"
                min={3}
                className="w-full rounded-md border border-border px-3 py-2 text-sm"
                value={tasks[item.id] ?? "3"}
                onChange={(event) => setTasks((current) => ({ ...current, [item.id]: event.target.value }))}
              />
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const result = await markPromptTested(
                    item.id,
                    notes[item.id] ?? "",
                    Number(tasks[item.id] ?? 3),
                  );
                  if (!result.ok) {
                    toast.error(result.error);
                    return;
                  }
                  toast.success("Marked as tested.");
                  window.location.reload();
                })
              }
            >
              Mark as tested
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const result = await returnPromptWithComments(item.id, notes[item.id] ?? "");
                  if (!result.ok) {
                    toast.error(result.error);
                    return;
                  }
                  toast.success("Returned to champion.");
                  window.location.reload();
                })
              }
            >
              Return with comments
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const reason = notes[item.id] ?? "";
                  const result = await retirePrompt(item.id, reason.length >= 10 ? reason : "Retired from review queue");
                  if (!result.ok) {
                    toast.error(result.error);
                    return;
                  }
                  toast.success("Prompt retired.");
                  window.location.reload();
                })
              }
            >
              Retire
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
