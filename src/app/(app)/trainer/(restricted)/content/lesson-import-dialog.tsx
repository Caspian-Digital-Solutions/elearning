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
  importLessonDrafts,
  previewLessonImports,
} from "@/app/(app)/trainer/(restricted)/content/lesson-actions";
import type { ImportPreviewRow } from "@/lib/lessons/import";

export function LessonImportDialog() {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<ImportPreviewRow[]>([]);
  const [files, setFiles] = useState<{ fileName: string; content: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onFiles = async (list: FileList | null) => {
    if (!list?.length) {
      return;
    }
    setBusy(true);
    setError(null);
    const loaded: { fileName: string; content: string }[] = [];
    for (const file of [...list]) {
      if (!file.name.endsWith(".md")) {
        continue;
      }
      loaded.push({ fileName: file.name, content: await file.text() });
    }
    const preview = await previewLessonImports(loaded);
    setBusy(false);
    if (!preview.ok) {
      setError(preview.error);
      return;
    }
    setFiles(loaded);
    setRows(preview.data.rows);
  };

  const confirm = async () => {
    setBusy(true);
    setError(null);
    const result = await importLessonDrafts(files);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    toast.success(`Imported ${result.data.imported} lesson draft${result.data.imported === 1 ? "" : "s"}.`);
    setOpen(false);
    setRows([]);
    setFiles([]);
  };

  const tableRows = rows.map((row) => ({
    fileName: row.fileName,
    moduleCode: row.moduleCode,
    title: row.title,
    kind: row.kind,
    duration: String(row.durationMin),
    departments: row.departments,
    result: row.duplicateNote ? `${row.result} ${row.duplicateNote}` : row.result,
  }));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" />}>Import lessons</DialogTrigger>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Import lesson drafts</DialogTitle>
        </DialogHeader>
        <FormError>{error}</FormError>
        <input
          type="file"
          accept=".md,text/markdown"
          multiple
          onChange={(event) => void onFiles(event.target.files)}
        />
        {rows.length > 0 ? (
          <DataTable
            rowKey="fileName"
            caption="Import preview"
            exportFileName="lesson-import-preview.csv"
            columns={[
              { key: "fileName", header: "File" },
              { key: "moduleCode", header: "Module" },
              { key: "title", header: "Title" },
              { key: "kind", header: "Kind" },
              { key: "duration", header: "Duration" },
              { key: "departments", header: "Departments" },
              { key: "result", header: "Result", wrap: true },
            ]}
            rows={tableRows}
          />
        ) : null}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            type="button"
            disabled={busy || !rows.some((row) => row.ready)}
            onClick={() => void confirm()}
          >
            Import ready files
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
