"use client";

import { useState } from "react";
import { toast } from "sonner";
import { DataTable } from "@/components/shared/data-table";
import { FormError } from "@/components/shared/form-error";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  importAssessmentDraft,
  previewAssessmentImport,
} from "@/app/(app)/trainer/(restricted)/content/assessment-actions";

export function AssessmentImportDialog() {
  const [open, setOpen] = useState(false);
  const [jsonText, setJsonText] = useState("");
  const [preview, setPreview] = useState<Awaited<ReturnType<typeof previewAssessmentImport>> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const runPreview = async () => {
    setBusy(true);
    setError(null);
    const result = await previewAssessmentImport(jsonText);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setPreview(result);
  };

  const confirm = async () => {
    setBusy(true);
    setError(null);
    const result = await importAssessmentDraft({ jsonText });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    toast.success("Assessment draft imported.");
    setOpen(false);
    setJsonText("");
    setPreview(null);
  };

  const sectionRows =
    preview?.ok && preview.data.ok
      ? preview.data.sections.map((s) => ({
          code: s.code,
          itemPoints: String(s.itemPoints),
          maxScore: s.maxScore === null ? "—" : String(s.maxScore),
          ok: s.ok ? "OK" : "Check",
        }))
      : [];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" />}>Import assessment</DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Import assessment JSON</DialogTitle>
        </DialogHeader>
        <FormError>{error}</FormError>
        {preview?.ok && !preview.data.ok ? (
          <ul className="list-disc pl-5 text-sm text-destructive">
            {preview.data.errors.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        ) : null}
        <textarea
          className="min-h-48 w-full rounded-md border p-2 font-mono text-sm"
          value={jsonText}
          onChange={(e) => {
            setJsonText(e.target.value);
            setPreview(null);
          }}
          placeholder="Paste assessment JSON (see docs/content/ASSESSMENT_FORMAT.md)"
        />
        {sectionRows.length > 0 ? (
          <DataTable
            rowKey="code"
            caption="Section points check"
            exportFileName="assessment-import-sections.csv"
            columns={[
              { key: "code", header: "Section" },
              { key: "itemPoints", header: "Item points" },
              { key: "maxScore", header: "Max" },
              { key: "ok", header: "Result" },
            ]}
            rows={sectionRows}
          />
        ) : null}
        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" disabled={busy} onClick={() => void runPreview()}>
            Validate
          </Button>
          <Button
            type="button"
            disabled={busy || !preview?.ok || !preview.data.ok}
            onClick={() => void confirm()}
          >
            Import draft
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
