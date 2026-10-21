"use client";

import { useState, useTransition } from "react";
import { MarkdownView } from "@/components/shared/markdown-view";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { loadAssessmentPreview } from "@/app/(app)/trainer/(restricted)/content/assessment-actions";

export function AssessmentPreviewDialog({ assessmentId }: { assessmentId: string }) {
  const [open, setOpen] = useState(false);
  const [showKeys, setShowKeys] = useState(false);
  const [preview, setPreview] = useState<Awaited<ReturnType<typeof loadAssessmentPreview>>>(null);
  const [pending, startTransition] = useTransition();

  const load = (keys: boolean) => {
    startTransition(async () => {
      const data = await loadAssessmentPreview(assessmentId, keys);
      setPreview(data);
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          load(showKeys);
        }
      }}
    >
      <DialogTrigger render={<Button variant="outline" size="sm" />}>Preview</DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto max-w-3xl">
        <DialogHeader>
          <DialogTitle>{preview?.payload.assessment.title ?? "Assessment preview"}</DialogTitle>
        </DialogHeader>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={showKeys}
            onChange={(e) => {
              setShowKeys(e.target.checked);
              load(e.target.checked);
            }}
          />
          Show keys (trainers only)
        </label>
        {pending ? <p className="text-sm text-muted-foreground">Loading…</p> : null}
        {preview ? (
          <div className="space-y-6">
            <MarkdownView markdown={preview.payload.assessment.instructionsMd || "_No instructions._"} nested />
            {preview.payload.sections.map((section) => (
              <section key={section.id} className="space-y-3">
                <h3 className="font-semibold">{section.title}</h3>
                {section.items.map((item) => (
                  <article key={item.id} className="rounded border p-3 text-sm space-y-2">
                    <p className="text-xs text-muted-foreground">{item.ref}</p>
                    <MarkdownView markdown={item.promptMd} nested />
                    {showKeys && preview.keys[item.id] ? (
                      <pre className="overflow-x-auto rounded bg-muted p-2 text-xs">
                        {JSON.stringify(preview.keys[item.id], null, 2)}
                      </pre>
                    ) : null}
                  </article>
                ))}
              </section>
            ))}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
