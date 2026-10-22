"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { DataTable } from "@/components/shared/data-table";
import { FormError } from "@/components/shared/form-error";
import { MarkdownView } from "@/components/shared/markdown-view";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime } from "@/lib/format";
import type { MarkingQueueRow } from "@/lib/assignments/queries";
import {
  loadAssignmentMarkingDetail,
  releaseAssignmentFeedback,
  requestAssignmentResubmission,
  saveAssignmentReview,
} from "@/app/(app)/trainer/marking/marking-actions";

export function AssignmentMarkingPanel({
  initialQueue,
  canModerate,
}: {
  initialQueue: MarkingQueueRow[];
  canModerate: boolean;
}) {
  const [hideNames, setHideNames] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Awaited<ReturnType<typeof loadAssignmentMarkingDetail>>>(null);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const queue = useMemo(() => {
    return initialQueue
      .map((row, index) => ({
        ...row,
        person: hideNames ? `Person ${index + 1}` : row.personName,
      }))
      .filter((row) => (statusFilter ? row.status === statusFilter : true));
  }, [hideNames, initialQueue, statusFilter]);

  const openRow = (submissionId: string) => {
    setActiveId(submissionId);
    setError(null);
    startTransition(async () => {
      const data = await loadAssignmentMarkingDetail(submissionId);
      setDetail(data);
      setScores(data?.existingScores ?? {});
      setFeedback(data?.feedbackMd ?? "");
    });
  };

  const saveMark = () => {
    if (!activeId || !detail) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await saveAssignmentReview({
        submissionId: activeId,
        kind: detail.reviewKind,
        criterionScores: scores,
        feedbackMd: feedback,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success("Mark saved.");
      window.location.reload();
    });
  };

  const release = () => {
    if (!activeId) {
      return;
    }
    startTransition(async () => {
      const result = await releaseAssignmentFeedback(activeId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success("Feedback released.");
      window.location.reload();
    });
  };

  const resubmit = () => {
    if (!activeId || !feedback.trim()) {
      setError("Add feedback before requesting resubmission.");
      return;
    }
    startTransition(async () => {
      const result = await requestAssignmentResubmission(activeId, feedback);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success("Resubmission requested.");
      window.location.reload();
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-4">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={hideNames} onChange={(e) => setHideNames(e.target.checked)} />
          Hide names
        </label>
        <div className="space-y-1">
          <Label>Status</Label>
          <NativeSelect value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All</option>
            <option value="submitted">Submitted</option>
            <option value="in_review">In review</option>
          </NativeSelect>
        </div>
      </div>

      <DataTable
        rowKey="submissionId"
        caption="Assignment marking queue"
        exportFileName="assignment-marking.csv"
        columns={[
          { key: "person", header: "Person" },
          { key: "department", header: "Department" },
          { key: "moduleCode", header: "Module" },
          { key: "assignmentTitle", header: "Assignment" },
          { key: "attemptNo", header: "Attempt" },
          { key: "submittedAt", header: "Submitted" },
          { key: "workingDays", header: "Working days" },
          { key: "statusLabel", header: "Status" },
          { key: "doubleMarkPending", header: "Double-mark pending" },
        ]}
        rows={queue.map((row) => ({
          submissionId: row.submissionId,
          person: row.person,
          department: row.department,
          moduleCode: row.moduleCode,
          assignmentTitle: row.assignmentTitle,
          attemptNo: String(row.attemptNo),
          submittedAt: formatDateTime(row.submittedAt),
          workingDays: String(row.workingDays),
          statusLabel: row.statusLabel,
          doubleMarkPending: row.doubleMarkPending ? "Yes" : "No",
        }))}
        rowActions={(row) => (
          <Button type="button" size="sm" variant="outline" onClick={() => openRow(row.submissionId)}>
            Mark
          </Button>
        )}
      />

      {activeId && detail ? (
        <div className="space-y-4 rounded-lg border p-4">
          <h2 className="text-lg font-semibold">Mark submission (attempt {detail.attemptNo})</h2>
          <FormError>{error}</FormError>
          <MarkdownView markdown={detail.briefMd || "_No brief._"} nested />
          {detail.linkUrl ? (
            <p className="text-sm">
              <span className="font-medium">Link:</span>{" "}
              <a className="underline" href={detail.linkUrl} target="_blank" rel="noreferrer">
                {detail.linkUrl}
              </a>
            </p>
          ) : null}
          {detail.filePath ? (
            <p className="text-sm">
              <span className="font-medium">File:</span>{" "}
              <Link className="underline" href={`/submission-file/${detail.filePath}`} target="_blank">
                Download
              </Link>
            </p>
          ) : null}
          {detail.textMd ? (
            <pre className="whitespace-pre-wrap rounded bg-muted p-3 text-sm">{detail.textMd}</pre>
          ) : null}
          {detail.criteria.map((crit) => (
            <div key={crit.id} className="space-y-1">
              <Label>{crit.name} (max {crit.maxScore})</Label>
              <NativeSelect
                value={scores[crit.id] !== undefined ? String(scores[crit.id]) : ""}
                onChange={(e) => setScores((prev) => ({ ...prev, [crit.id]: Number(e.target.value) }))}
              >
                <option value="">Choose level</option>
                {crit.levels.map((level) => (
                  <option key={level.score} value={level.score}>
                    {level.score} — {level.descriptor}
                  </option>
                ))}
              </NativeSelect>
            </div>
          ))}
          <Textarea
            placeholder="Feedback for the learner"
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            rows={4}
          />
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => setActiveId(null)}>Cancel</Button>
            <Button type="button" disabled={pending} onClick={saveMark}>Save mark</Button>
            {canModerate ? (
              <>
                <Button type="button" variant="outline" disabled={pending} onClick={resubmit}>
                  Request resubmission
                </Button>
                <Button type="button" disabled={pending} onClick={release}>Release feedback</Button>
              </>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
