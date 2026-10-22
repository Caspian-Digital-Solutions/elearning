"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { FormError } from "@/components/shared/form-error";
import { MarkdownView } from "@/components/shared/markdown-view";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime } from "@/lib/format";
import type { LearnerAssignmentDetail } from "@/lib/assignments/queries";
import {
  prepareSubmissionUpload,
  submitAssignment,
} from "@/app/(app)/assignments/assignment-actions";
import { createClient } from "@/lib/supabase/client";

export function AssignmentDetailScreen({ detail }: { detail: LearnerAssignmentDetail }) {
  const [linkUrl, setLinkUrl] = useState("");
  const [textMd, setTextMd] = useState("");
  const [filePath, setFilePath] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [declared, setDeclared] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const types = new Set(detail.submissionTypes);

  const uploadFile = async (file: File) => {
    setError(null);
    const prepared = await prepareSubmissionUpload(detail.id, file.name, file.type, file.size);
    if (!prepared.ok) {
      setError(prepared.error);
      return;
    }
    const supabase = createClient();
    const { error: uploadError } = await supabase.storage
      .from("submissions")
      .upload(prepared.data.path, file, { upsert: true });
    if (uploadError) {
      setError("The file could not be uploaded.");
      return;
    }
    setFilePath(prepared.data.path);
    setFileName(file.name);
    toast.success("File ready to submit.");
  };

  const onSubmit = () => {
    setError(null);
    startTransition(async () => {
      const result = await submitAssignment({
        assignmentId: detail.id,
        linkUrl: types.has("link") && linkUrl.trim() ? linkUrl.trim() : undefined,
        textMd: types.has("text") && textMd.trim() ? textMd.trim() : undefined,
        filePath: types.has("file") && filePath ? filePath : undefined,
        dataDeclaration: true,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success("Assignment submitted.");
      setConfirmOpen(false);
      window.location.reload();
    });
  };

  const latest = detail.latestSubmission;

  return (
    <div className="space-y-6">
      <PageHeader
        title={detail.title}
        purpose={`${detail.moduleCode} · ${detail.moduleTitle} · Pass mark ${detail.passMarkPct}%`}
      />
      <Button variant="outline" size="sm" render={<Link href="/assignments" />}>Back to assignments</Button>

      <section className="space-y-2">
        <h2 className="font-heading text-lg">Brief</h2>
        <MarkdownView markdown={detail.briefMd || "_No brief yet._"} nested />
      </section>

      <section className="space-y-2">
        <h2 className="font-heading text-lg">Rubric</h2>
        <ul className="list-disc space-y-2 pl-5 text-sm">
          {detail.criteria.map((crit) => (
            <li key={crit.id}>
              <span className="font-medium">{crit.name}</span> (max {crit.maxScore})
              <ul className="mt-1 list-disc pl-5 text-muted-foreground">
                {crit.levels.map((level) => (
                  <li key={level.score}>{level.score} — {level.descriptor}</li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-lg border bg-muted/30 p-4 text-sm">
        <h2 className="font-medium">How to share a Claude chat in CDS</h2>
        <p className="mt-2 text-muted-foreground">
          In Claude, open your conversation, choose Share, and copy the link. Paste that https link
          below. Only claude.ai, docs.google.com and drive.google.com links are accepted.
        </p>
      </section>

      {latest?.status === "returned" || latest?.status === "resubmit_requested" ? (
        <section className="space-y-3 rounded-lg border p-4">
          <h2 className="font-heading text-lg">Feedback</h2>
          {latest.releasedTotal !== null && latest.releasedMax !== null ? (
            <p className="text-sm font-medium">
              Mark: {latest.releasedTotal} of {latest.releasedMax} ({latest.releasedPct}%)
            </p>
          ) : null}
          {latest.feedbackMd ? <MarkdownView markdown={latest.feedbackMd} nested /> : null}
          {latest.markerName && latest.releasedAt ? (
            <p className="text-sm text-muted-foreground">
              {latest.markerName} · {formatDateTime(latest.releasedAt)}
            </p>
          ) : null}
          {latest.criterionLevels.length > 0 ? (
            <ul className="text-sm">
              {latest.criterionLevels.map((row) => (
                <li key={row.name}>{row.name}: {row.score} — {row.descriptor}</li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      {detail.canSubmit ? (
        <section className="space-y-4 rounded-lg border p-4">
          <h2 className="font-heading text-lg">Hand in</h2>
          <FormError>{error}</FormError>
          {types.has("link") ? (
            <div className="space-y-1">
              <Label>Link</Label>
              <input
                className="w-full rounded-md border px-3 py-2 text-sm"
                type="url"
                placeholder="https://claude.ai/chat/…"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
              />
            </div>
          ) : null}
          {types.has("text") ? (
            <div className="space-y-1">
              <Label>Written response (Markdown)</Label>
              <Textarea rows={8} value={textMd} onChange={(e) => setTextMd(e.target.value)} />
            </div>
          ) : null}
          {types.has("file") ? (
            <div className="space-y-1">
              <Label>File</Label>
              <input
                ref={fileRef}
                type="file"
                className="text-sm"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    void uploadFile(file);
                  }
                }}
              />
              {fileName ? <p className="text-sm text-muted-foreground">Selected: {fileName}</p> : null}
            </div>
          ) : null}
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={declared}
              onChange={(e) => setDeclared(e.target.checked)}
            />
            <span>
              I confirm this is my own work and does not include confidential client data unless
              approved.
            </span>
          </label>
          <Button
            type="button"
            disabled={!declared || pending}
            onClick={() => setConfirmOpen(true)}
          >
            Review and submit
          </Button>
          {confirmOpen ? (
            <div className="space-y-2 rounded border p-3">
              <p className="text-sm">Submit this attempt? You cannot edit it while it is being marked.</p>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setConfirmOpen(false)}>Cancel</Button>
                <Button type="button" disabled={pending} onClick={onSubmit}>Confirm submit</Button>
              </div>
            </div>
          ) : null}
        </section>
      ) : latest ? (
        <p className="text-sm text-muted-foreground">
          Attempt {latest.attemptNo} · {formatDateTime(latest.submittedAt)} · Status: {latest.status}
        </p>
      ) : null}

      {detail.history.length > 1 ? (
        <section className="space-y-2">
          <h2 className="font-heading text-lg">Attempt history</h2>
          <ul className="text-sm text-muted-foreground">
            {detail.history.map((row) => (
              <li key={row.id}>
                Attempt {row.attemptNo} · {formatDateTime(row.submittedAt)} · {row.status}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
