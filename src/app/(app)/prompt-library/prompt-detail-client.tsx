"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { MarkdownView } from "@/components/shared/markdown-view";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { givePromptFeedbackAction, logPromptCopyAction } from "@/lib/prompts/actions";
import { fillPromptBody, humanizePlaceholder, parsePlaceholders } from "@/lib/prompts/placeholders";
import { riskTierLabels, riskTierReminder } from "@/lib/prompts/risk-tier";
import type { PromptRow } from "@/lib/prompts/types";
import { formatDate } from "@/lib/format";

export function PromptDetailClient({
  prompt,
  ownerName,
  departmentName,
  moduleLink,
}: {
  prompt: PromptRow;
  ownerName: string;
  departmentName: string;
  moduleLink: { href: string; label: string } | null;
}) {
  const placeholders = useMemo(() => parsePlaceholders(prompt.body), [prompt.body]);
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(placeholders.map((name) => [name, ""])),
  );
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [outcome, setOutcome] = useState<"worked" | "needed_edits" | "did_not_work" | "">("");
  const [comment, setComment] = useState("");
  const [declaration, setDeclaration] = useState(false);

  const filled = fillPromptBody(prompt.body, values);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(filled);
      const logged = await logPromptCopyAction({
        promptId: prompt.id,
        promptVersion: prompt.version,
      });
      if (!logged.ok) {
        toast.error(logged.error);
        return;
      }
      toast.success("Prompt copied.");
      setFeedbackOpen(true);
    } catch {
      toast.error("Could not copy to the clipboard.");
    }
  };

  const segments = useMemo(() => {
    const parts: { text: string; placeholder?: string }[] = [];
    const re = /\{\{([a-z][a-z0-9_]*)\}\}/gi;
    let last = 0;
    for (const match of prompt.body.matchAll(re)) {
      const index = match.index ?? 0;
      if (index > last) {
        parts.push({ text: prompt.body.slice(last, index) });
      }
      parts.push({ text: match[0], placeholder: match[1].toLowerCase() });
      last = index + match[0].length;
    }
    if (last < prompt.body.length) {
      parts.push({ text: prompt.body.slice(last) });
    }
    return parts;
  }, [prompt.body]);

  return (
    <div className="space-y-8">
      <div className="rounded-lg border border-border bg-surface p-4 text-sm leading-relaxed whitespace-pre-wrap">
        {segments.map((part, index) =>
          part.placeholder ? (
            <mark key={index} className="rounded bg-amber-100 px-1 text-heading">
              {part.text}
            </mark>
          ) : (
            <span key={index}>{part.text}</span>
          ),
        )}
      </div>

      {prompt.usage_notes_md ? (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-heading">Usage notes</h2>
          <MarkdownView markdown={prompt.usage_notes_md} />
        </section>
      ) : null}

      {prompt.example_md ? (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-heading">Example</h2>
          <MarkdownView markdown={prompt.example_md} />
        </section>
      ) : null}

      <section className="space-y-2 text-sm">
        <p>
          <span className="font-medium text-heading">Risk tier:</span> {riskTierLabels[prompt.risk_tier]} —{" "}
          {riskTierReminder[prompt.risk_tier]}{" "}
          <Link href="/help/risk-tiers" className="text-accent-strong underline underline-offset-2">
            Risk tiers help
          </Link>
        </p>
        {moduleLink ? (
          <p>
            <span className="font-medium text-heading">Module:</span>{" "}
            <Link href={moduleLink.href} className="text-accent-strong underline underline-offset-2">
              {moduleLink.label}
            </Link>
          </p>
        ) : null}
        <p>
          <span className="font-medium text-heading">Owner:</span> {ownerName} · Version {prompt.version} · Tested{" "}
          {formatDate(prompt.tested_at)}
        </p>
        <p>
          <span className="font-medium text-heading">Department:</span> {departmentName}
        </p>
      </section>

      <section className="space-y-3 rounded-lg border border-border bg-surface p-4">
        <h2 className="text-lg font-semibold text-heading">Fill in and copy</h2>
        <p className="text-sm text-muted-foreground">What you type here stays in your browser.</p>
        {placeholders.map((name) => (
          <div key={name} className="space-y-1">
            <Label htmlFor={`ph-${name}`}>{humanizePlaceholder(name)}</Label>
            <Input
              id={`ph-${name}`}
              value={values[name] ?? ""}
              onChange={(event) => setValues((current) => ({ ...current, [name]: event.target.value }))}
            />
          </div>
        ))}
        <Button type="button" onClick={() => void copy()}>Copy prompt</Button>
      </section>

      {feedbackOpen ? (
        <section className="space-y-3 rounded-lg border border-border p-4">
          <h2 className="text-base font-semibold text-heading">Did it work?</h2>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["worked", "Worked"],
                ["needed_edits", "Needed edits"],
                ["did_not_work", "Did not work"],
              ] as const
            ).map(([value, label]) => (
              <Button
                key={value}
                type="button"
                size="sm"
                variant={outcome === value ? "default" : "outline"}
                onClick={() => setOutcome(value)}
              >
                {label}
              </Button>
            ))}
          </div>
          <div className="space-y-1">
            <Label htmlFor="feedback-comment">Optional comment</Label>
            <Textarea
              id="feedback-comment"
              rows={3}
              maxLength={500}
              value={comment}
              onChange={(event) => setComment(event.target.value)}
            />
          </div>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-1 size-4 accent-accent-strong"
              checked={declaration}
              onChange={(event) => setDeclaration(event.target.checked)}
            />
            My comment does not include client data.
          </label>
          <Button
            type="button"
            disabled={!outcome || !declaration}
            onClick={() => {
              if (!outcome) {
                return;
              }
              void givePromptFeedbackAction({
                promptId: prompt.id,
                promptVersion: prompt.version,
                outcome,
                comment: comment.trim() || undefined,
                declaration: true,
              }).then((result) => {
                if (result.ok) {
                  toast.success("Thanks for the feedback.");
                  setFeedbackOpen(false);
                } else {
                  toast.error(result.error);
                }
              });
            }}
          >
            Send feedback
          </Button>
        </section>
      ) : null}
    </div>
  );
}
