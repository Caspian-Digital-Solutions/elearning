"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { markLessonComplete, unmarkLessonComplete } from "@/app/(app)/lessons/actions";
import { formatDate } from "@/lib/format";

export function LessonCompleteBox({
  lessonId,
  completedAt,
  lessonVersion,
  storedVersion,
}: {
  lessonId: string;
  completedAt: string | null;
  lessonVersion: number;
  storedVersion: number | null;
}) {
  const [busy, setBusy] = useState(false);

  const toggle = async () => {
    setBusy(true);
    const result = completedAt
      ? await unmarkLessonComplete(lessonId)
      : await markLessonComplete(lessonId);
    setBusy(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(completedAt ? "Marked as not complete." : "Marked as complete.");
  };

  return (
    <div className="space-y-2 rounded-lg border border-border p-4">
      {completedAt ? (
        <p className="text-sm">Completed on {formatDate(completedAt)}</p>
      ) : null}
      {completedAt && storedVersion !== null && lessonVersion > storedVersion ? (
        <p className="text-sm text-amber-700">Updated since you completed it</p>
      ) : null}
      <Button type="button" variant="outline" disabled={busy} onClick={() => void toggle()}>
        {completedAt ? "Mark as not complete" : "Mark as complete"}
      </Button>
    </div>
  );
}
