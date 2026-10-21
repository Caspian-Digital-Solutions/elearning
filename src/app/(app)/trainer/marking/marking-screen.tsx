"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { DataTable } from "@/components/shared/data-table";
import { FormError } from "@/components/shared/form-error";
import { MarkdownView } from "@/components/shared/markdown-view";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import type { MarkingQueueRow } from "@/lib/assessments/queries";
import { formatDateTime } from "@/lib/format";
import { loadMarkingDetail, saveMark, type MarkingDetail } from "@/app/(app)/trainer/marking/marking-actions";

export function MarkingScreen({ initialQueue }: { initialQueue: MarkingQueueRow[] }) {
  const [hideNames, setHideNames] = useState(true);
  const [sectionFilter, setSectionFilter] = useState("");
  const [markedFilter, setMarkedFilter] = useState<"all" | "unmarked" | "marked">("unmarked");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [detail, setDetail] = useState<MarkingDetail | null>(null);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const queue = useMemo(() => {
    return initialQueue
      .map((row) => ({
        ...row,
        person: hideNames ? row.personLabel : row.personName,
      }))
      .filter((row) => (sectionFilter ? row.sectionCode === sectionFilter : true))
      .filter((row) => {
        if (markedFilter === "marked") {
          return row.marked;
        }
        if (markedFilter === "unmarked") {
          return !row.marked;
        }
        return true;
      });
  }, [hideNames, initialQueue, markedFilter, sectionFilter]);

  const sections = useMemo(
    () => [...new Set(initialQueue.map((row) => row.sectionCode).filter(Boolean))].sort(),
    [initialQueue],
  );

  const openMark = (responseId: string) => {
    setActiveId(responseId);
    setError(null);
    startTransition(async () => {
      const data = await loadMarkingDetail(responseId);
      setDetail(data);
      setScores({});
      setComment("");
    });
  };

  const submitMark = () => {
    if (!activeId) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await saveMark({
        responseId: activeId,
        criterionScores: scores,
        commentMd: comment,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success("Mark saved.");
      setActiveId(null);
      setDetail(null);
      window.location.reload();
    });
  };

  const markedCount = initialQueue.filter((r) => r.marked).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Marking queue"
        purpose="Mark Week 0 written and practical responses. Names are hidden by default."
      />
      <div className="flex flex-wrap items-end gap-4">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={hideNames} onChange={(e) => setHideNames(e.target.checked)} />
          Hide names
        </label>
        <div className="space-y-1">
          <Label>Section</Label>
          <NativeSelect value={sectionFilter} onChange={(e) => setSectionFilter(e.target.value)}>
            <option value="">All sections</option>
            {sections.map((code) => (
              <option key={code} value={code}>{code}</option>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-1">
          <Label>Status</Label>
          <NativeSelect
            value={markedFilter}
            onChange={(e) => setMarkedFilter(e.target.value as "all" | "unmarked" | "marked")}
          >
            <option value="unmarked">Needs marking</option>
            <option value="marked">Marked</option>
            <option value="all">All</option>
          </NativeSelect>
        </div>
        <p className="text-sm text-muted-foreground">
          {markedCount} of {initialQueue.length} marked
        </p>
      </div>

      <DataTable
        rowKey="responseId"
        caption="Week 0 marking queue"
        exportFileName="week0-marking.csv"
        columns={[
          { key: "person", header: "Person" },
          { key: "department", header: "Department" },
          { key: "sectionTitle", header: "Section" },
          { key: "itemRef", header: "Item" },
          { key: "submittedAt", header: "Submitted" },
        ]}
        rows={queue.map((row) => ({
          responseId: row.responseId,
          attemptId: row.attemptId,
          person: hideNames ? row.personLabel : row.personName,
          department: row.department,
          sectionTitle: row.sectionTitle,
          itemRef: row.itemRef,
          submittedAt: row.submittedAt ? formatDateTime(row.submittedAt) : "—",
          marked: row.marked ? "yes" : "no",
        }))}
        rowActions={(row) => (
          <Button type="button" size="sm" variant="outline" onClick={() => openMark(row.responseId)}>
            {row.marked ? "Review" : "Mark"}
          </Button>
        )}
      />

      {activeId && detail ? (
        <div className="space-y-4 rounded-lg border p-4">
          <h2 className="text-lg font-semibold">Mark response</h2>
          <FormError>{error}</FormError>
          <MarkdownView markdown={detail.promptMd || "_No prompt._"} nested />
          <pre className="whitespace-pre-wrap rounded bg-muted p-3 text-sm">
            {JSON.stringify(detail.answer, null, 2)}
          </pre>
          {detail.modelAnswerMd ? (
            <div>
              <h3 className="font-medium">Model answer</h3>
              <MarkdownView markdown={detail.modelAnswerMd} nested />
            </div>
          ) : null}
          {detail.markingNotesMd ? (
            <div>
              <h3 className="font-medium">Marking notes</h3>
              <MarkdownView markdown={detail.markingNotesMd} nested />
            </div>
          ) : null}
          {detail.criteria.map((crit) => (
            <div key={crit.id} className="space-y-1">
              <Label>{crit.name} (max {crit.maxScore})</Label>
              <NativeSelect
                value={scores[crit.id] !== undefined ? String(scores[crit.id]) : ""}
                onChange={(e) =>
                  setScores((prev) => ({ ...prev, [crit.id]: Number(e.target.value) }))
                }
              >
                <option value="">Choose level</option>
                {crit.levels
                  .sort((a, b) => a.score - b.score)
                  .map((level) => (
                    <option key={level.score} value={level.score}>
                      {level.score} — {level.descriptor}
                    </option>
                  ))}
              </NativeSelect>
            </div>
          ))}
          <Textarea
            placeholder="Comment for the learner (optional)"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
          />
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => setActiveId(null)}>Cancel</Button>
            <Button type="button" disabled={pending} onClick={submitMark}>Save and close</Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
