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
import { Textarea } from "@/components/ui/textarea";
import { importPromptsJson } from "@/lib/prompts/actions";

export function PromptImportDialog({
  departmentCodes,
  moduleCodes,
}: {
  departmentCodes: string[];
  moduleCodes: string[];
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button type="button" variant="outline" />}>Import JSON</DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import prompt drafts</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Paste JSON per <code className="text-xs">docs/content/PROMPT_FORMAT.md</code>. Imports create drafts only.
        </p>
        <Textarea value={text} onChange={(event) => setText(event.target.value)} rows={12} className="font-mono text-xs" />
        <FormError>{error}</FormError>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            type="button"
            disabled={pending || !text.trim()}
            onClick={() => {
              setPending(true);
              setError(null);
              void importPromptsJson(text, { departmentCodes, moduleCodes }).then((result) => {
                setPending(false);
                if (!result.ok) {
                  setError(result.error);
                  return;
                }
                toast.success(`Imported ${result.count} draft${result.count === 1 ? "" : "s"}.`);
                setOpen(false);
                setText("");
                window.location.reload();
              });
            }}
          >
            Import
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
