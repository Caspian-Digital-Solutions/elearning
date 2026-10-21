"use client";

import { useCallback, useEffect, useRef, useState, type DragEvent, type ReactNode } from "react";
import TurndownService from "turndown";
import { MarkdownView } from "@/components/shared/markdown-view";
import { FormError } from "@/components/shared/form-error";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import type { ActionResult } from "@/lib/actions/result";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { readingMinutes, wordCount } from "@/lib/content/reading";
import { cn } from "@/lib/utils";

const turndown = new TurndownService({ headingStyle: "atx", bulletListMarker: "-" });
turndown.remove("img");

type MarkdownEditorProps = {
  title: string;
  body: string;
  onTitleChange: (value: string) => void;
  onBodyChange: (value: string) => void;
  onSaveDraft: () => void | Promise<void>;
  onPublish: () => void;
  publishVersionLabel: string;
  saving?: boolean;
  extraFields?: ReactNode;
  historyPanel?: ReactNode;
  imageUpload?: {
    contentId: string;
    folder: "lessons" | "pages";
    upload: (formData: FormData) => Promise<ActionResult<{ markdown: string }>>;
  };
};

function insertAround(text: string, before: string, after: string, selectionStart: number, selectionEnd: number) {
  const selected = text.slice(selectionStart, selectionEnd);
  const next = `${text.slice(0, selectionStart)}${before}${selected}${after}${text.slice(selectionEnd)}`;
  const cursor = selectionStart + before.length + selected.length + after.length;
  return { next, cursor };
}

export function MarkdownEditor({
  title,
  body,
  onTitleChange,
  onBodyChange,
  onSaveDraft,
  onPublish,
  publishVersionLabel,
  saving,
  extraFields,
  historyPanel,
  imageUpload,
}: MarkdownEditorProps) {
  const [dirty, setDirty] = useState(false);
  const [tab, setTab] = useState("write");
  const [imageOpen, setImageOpen] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [imageAlt, setImageAlt] = useState("");
  const [noClientData, setNoClientData] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (dirty) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const markDirty = useCallback(() => setDirty(true), []);

  const wrapSelection = (before: string, after: string) => {
    const el = areaRef.current;
    if (!el) {
      return;
    }
    const { next, cursor } = insertAround(body, before, after, el.selectionStart, el.selectionEnd);
    onBodyChange(next);
    markDirty();
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(cursor, cursor);
    });
  };

  const insertLine = (line: string) => {
    const el = areaRef.current;
    const start = el?.selectionStart ?? body.length;
    const next = `${body.slice(0, start)}${line}\n${body.slice(start)}`;
    onBodyChange(next);
    markDirty();
  };

  const insertMarkdownAtCursor = (snippet: string) => {
    const el = areaRef.current;
    const start = el?.selectionStart ?? body.length;
    const next = `${body.slice(0, start)}${snippet}${body.slice(start)}`;
    onBodyChange(next);
    markDirty();
  };

  const queueImageFile = (file: File) => {
    if (!imageUpload) {
      return;
    }
    setPendingFile(file);
    setImageAlt("");
    setNoClientData(false);
    setImageError(null);
    setImageOpen(true);
  };

  const confirmImageUpload = async () => {
    if (!imageUpload || !pendingFile) {
      return;
    }
    setUploadingImage(true);
    setImageError(null);
    const formData = new FormData();
    formData.set("folder", imageUpload.folder);
    formData.set("contentId", imageUpload.contentId);
    formData.set("alt", imageAlt);
    formData.set("noClientData", noClientData ? "true" : "false");
    formData.set("file", pendingFile);
    const result = await imageUpload.upload(formData);
    setUploadingImage(false);
    if (!result.ok) {
      setImageError(result.error);
      return;
    }
    insertMarkdownAtCursor(`\n${result.data.markdown}\n`);
    setImageOpen(false);
    setPendingFile(null);
  };

  const onTextareaPaste = (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    if (!imageUpload) {
      return;
    }
    const items = event.clipboardData?.items;
    if (!items) {
      return;
    }
    for (const item of items) {
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) {
          event.preventDefault();
          queueImageFile(file);
          return;
        }
      }
    }
  };

  const onDrop = (event: DragEvent) => {
    if (!imageUpload) {
      return;
    }
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    if (file?.type.startsWith("image/")) {
      queueImageFile(file);
    }
  };

  const pasteFromDocs = async () => {
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        if (item.types.includes("text/html")) {
          const blob = await item.getType("text/html");
          const html = await blob.text();
          const md = turndown.turndown(html);
          onBodyChange(body ? `${body}\n\n${md}` : md);
          markDirty();
          return;
        }
      }
      const text = await navigator.clipboard.readText();
      if (text) {
        onBodyChange(body ? `${body}\n\n${text}` : text);
        markDirty();
      }
    } catch {
      // Clipboard may be blocked; person can paste into the box manually.
    }
  };

  const words = wordCount(body);
  const minutes = readingMinutes(body);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="content-title">Title</Label>
        <input
          id="content-title"
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
          value={title}
          onChange={(event) => {
            onTitleChange(event.target.value);
            markDirty();
          }}
        />
      </div>
      {extraFields}
      <div className="flex flex-wrap gap-2">
        <ToolbarButton onClick={() => wrapSelection("## ", "")}>Heading</ToolbarButton>
        <ToolbarButton onClick={() => wrapSelection("**", "**")}>Bold</ToolbarButton>
        <ToolbarButton onClick={() => wrapSelection("*", "*")}>Italic</ToolbarButton>
        <ToolbarButton onClick={() => insertLine("- ")}>Bullet list</ToolbarButton>
        <ToolbarButton onClick={() => insertLine("1. ")}>Numbered list</ToolbarButton>
        <ToolbarButton onClick={() => wrapSelection("[", "](https://)")}>Link</ToolbarButton>
        <ToolbarButton
          onClick={() =>
            insertLine("| Column | Column |\n| --- | --- |\n| Cell | Cell |")
          }
        >
          Table
        </ToolbarButton>
        <ToolbarButton onClick={() => insertLine("> Quote")}>Quote</ToolbarButton>
        <ToolbarButton onClick={() => insertLine("> [!NOTE]\n> ")}>Note</ToolbarButton>
        <ToolbarButton onClick={() => insertLine("> [!WARNING]\n> ")}>Warning</ToolbarButton>
        <ToolbarButton onClick={() => insertLine("> [!IMPORTANT]\n> ")}>Important</ToolbarButton>
        {imageUpload ? (
          <>
            <ToolbarButton onClick={() => fileInputRef.current?.click()}>Image</ToolbarButton>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  queueImageFile(file);
                }
                event.target.value = "";
              }}
            />
          </>
        ) : null}
        <Button type="button" variant="outline" size="sm" onClick={() => void pasteFromDocs()}>
          Paste from Word or Google Docs
        </Button>
      </div>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="write">Write</TabsTrigger>
          <TabsTrigger value="preview">Preview</TabsTrigger>
          <TabsTrigger value="split" className="hidden lg:inline-flex">Side by side</TabsTrigger>
        </TabsList>
        <TabsContent value="write" className="mt-3">
          <div
            onDragOver={(event) => imageUpload && event.preventDefault()}
            onDrop={onDrop}
          >
            <Textarea
              ref={areaRef}
              value={body}
              onChange={(event) => {
                onBodyChange(event.target.value);
                markDirty();
              }}
              onPaste={onTextareaPaste}
              className="min-h-[320px] font-mono text-sm"
              aria-label="Markdown body"
            />
          </div>
          {imageUpload ? (
            <p className="mt-1 text-xs text-muted">Drop or paste an image to upload (after saving a draft).</p>
          ) : null}
        </TabsContent>
        <TabsContent value="preview" className="mt-3 rounded-lg border border-border bg-surface p-4">
          <MarkdownView markdown={body || "_Nothing to preview yet._"} />
        </TabsContent>
        <TabsContent value="split" className="mt-3 hidden lg:grid lg:grid-cols-2 lg:gap-4">
          <Textarea
            value={body}
            onChange={(event) => {
              onBodyChange(event.target.value);
              markDirty();
            }}
            className="min-h-[360px] font-mono text-sm"
            aria-label="Markdown body"
          />
          <div className="rounded-lg border border-border bg-surface p-4">
            <MarkdownView markdown={body || "_Nothing to preview yet._"} />
          </div>
        </TabsContent>
      </Tabs>
      <p className="text-sm text-muted">
        {words} {words === 1 ? "word" : "words"} · about {minutes} min read
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={saving}
          onClick={() => {
            void Promise.resolve(onSaveDraft()).then(() => setDirty(false));
          }}
        >
          Save draft
        </Button>
        <Button type="button" disabled={saving} onClick={onPublish}>
          Publish…
        </Button>
        <span className="self-center text-sm text-muted">{publishVersionLabel}</span>
      </div>
      {historyPanel}
      <Dialog open={imageOpen} onOpenChange={setImageOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload image</DialogTitle>
          </DialogHeader>
          <FormError>{imageError}</FormError>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="image-alt">Alt text</Label>
              <input
                id="image-alt"
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
                value={imageAlt}
                onChange={(event) => setImageAlt(event.target.value)}
              />
            </div>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={noClientData}
                onChange={(event) => setNoClientData(event.target.checked)}
              />
              This image contains no client names, client data or personal information.
            </label>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setImageOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={uploadingImage || !pendingFile}
              onClick={() => void confirmImageUpload()}
            >
              Upload
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ToolbarButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <Button type="button" variant="outline" size="sm" className={cn("h-8")} onClick={onClick}>
      {children}
    </Button>
  );
}
