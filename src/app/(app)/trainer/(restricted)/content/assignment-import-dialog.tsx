"use client";

import { useState } from "react";
import { toast } from "sonner";
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
  importAssignmentDraft,
  previewAssignmentImport,
} from "@/app/(app)/trainer/(restricted)/content/assignment-actions";

export function AssignmentImportDialog() {
  const [open, setOpen] = useState(false);
  const [jsonText, setJsonText] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const runPreview = async () => {
    setBusy(true);
    const result = await previewAssignmentImport(jsonText);
    setBusy(false);
    if (!result.ok) {
      setErrors([result.error]);
      return;
    }
    setErrors(result.data.errors);
  };

  const confirm = async () => {
    setBusy(true);
    const result = await importAssignmentDraft({ jsonText });
    setBusy(false);
    if (!result.ok) {
      setErrors([result.error]);
      return;
    }
    toast.success("Assignment draft imported.");
    setOpen(false);
    window.location.href = `/trainer/content/assignments/${result.data.id}`;
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" />}>Import assignment</DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import assignment JSON</DialogTitle>
        </DialogHeader>
        <textarea
          className="min-h-48 w-full rounded-md border p-2 font-mono text-sm"
          value={jsonText}
          onChange={(e) => setJsonText(e.target.value)}
          placeholder="Paste assignment JSON (see docs/content/ASSIGNMENT_FORMAT.md)"
        />
        <FormError>{errors.length ? errors.join(" ") : null}</FormError>
        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" disabled={busy} onClick={runPreview}>Validate</Button>
          <Button type="button" disabled={busy || errors.length > 0} onClick={confirm}>Import first assignment</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
