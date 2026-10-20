"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import TurndownService from "turndown";
import { MarkdownView } from "@/components/shared/markdown-view";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
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
}: MarkdownEditorProps) {
  const [dirty, setDirty] = useState(false);
  const [tab, setTab] = useState("write");
  const areaRef = useRef<HTMLTextAreaElement>(null);

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
          <Textarea
            ref={areaRef}
            value={body}
            onChange={(event) => {
              onBodyChange(event.target.value);
              markDirty();
            }}
            className="min-h-[320px] font-mono text-sm"
            aria-label="Markdown body"
          />
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
