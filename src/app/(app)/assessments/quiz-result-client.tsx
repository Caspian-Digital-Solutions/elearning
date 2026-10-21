"use client";

import { useEffect, useState } from "react";
import { MarkdownView } from "@/components/shared/markdown-view";
import { loadAttemptReview, type AttemptReviewRow } from "@/app/(app)/assessments/review-actions";

export function QuizResultClient({
  attemptId,
  outcomeLabel,
  passMarkPct,
}: {
  attemptId: string;
  outcomeLabel: string;
  passMarkPct: number | null;
}) {
  const [rows, setRows] = useState<AttemptReviewRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadAttemptReview(attemptId).then((result) => {
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setRows(result.data);
    });
  }, [attemptId]);

  return (
    <div className="space-y-6">
      <div className="rounded-lg border p-6 space-y-2">
        <p className="text-lg font-semibold">{outcomeLabel}</p>
        {passMarkPct !== null && passMarkPct > 0 ? (
          <p className="text-sm text-muted-foreground">Pass mark {passMarkPct}%</p>
        ) : null}
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {rows ? (
        <section className="space-y-4">
          <h2 className="font-heading text-lg">Review</h2>
          {rows.map((row) => (
            <article key={row.itemId} className="space-y-2 rounded-lg border p-4 text-sm">
              <MarkdownView markdown={row.promptMd} nested />
              <p>
                <span className="font-medium">Your answer:</span> {row.chosenText ?? "—"}
              </p>
              <p>
                <span className="font-medium">Correct answer:</span> {row.correctText ?? "—"}
              </p>
              {row.explanationMd ? (
                <div className="text-muted-foreground">
                  <MarkdownView markdown={row.explanationMd} nested />
                </div>
              ) : null}
            </article>
          ))}
        </section>
      ) : error ? null : (
        <p className="text-sm text-muted-foreground">Loading review…</p>
      )}
    </div>
  );
}
