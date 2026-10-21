"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { MarkdownView } from "@/components/shared/markdown-view";
import { FormError } from "@/components/shared/form-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { LearnerAssessmentPayload, LearnerChoiceOption } from "@/lib/assessments/learner-payload";
import {
  saveAssessmentResponse,
  submitAssessmentAttempt,
  updateAttemptSeconds,
} from "@/app/(app)/assessments/attempt-actions";

type SavedMap = Record<string, Record<string, unknown>>;

function orderedOptions(
  itemId: string,
  options: LearnerChoiceOption[],
  meta: Record<string, unknown>,
): LearnerChoiceOption[] {
  const orderRoot = meta.option_order;
  if (!orderRoot || typeof orderRoot !== "object") {
    return options;
  }
  const order = (orderRoot as Record<string, unknown>)[itemId];
  if (!Array.isArray(order)) {
    return options;
  }
  const byId = new Map(options.map((o) => [o.id, o]));
  const sorted: LearnerChoiceOption[] = [];
  for (const id of order) {
    if (typeof id === "string" && byId.has(id)) {
      sorted.push(byId.get(id)!);
    }
  }
  for (const opt of options) {
    if (!sorted.some((s) => s.id === opt.id)) {
      sorted.push(opt);
    }
  }
  return sorted;
}

function isAnswered(type: string, answer: Record<string, unknown> | undefined): boolean {
  if (!answer) {
    return false;
  }
  if (type === "profile" || type === "choice") {
    return typeof answer.option_id === "string" && answer.option_id.length > 0;
  }
  if (type === "short_text") {
    return typeof answer.text === "string" && answer.text.trim().length > 0;
  }
  if (type === "practical") {
    const fmt = answer.format;
    if (fmt === "link") {
      return typeof answer.url === "string" && answer.url.trim().length > 0;
    }
    if (fmt === "prompt_and_output") {
      return (
        typeof answer.prompt === "string" &&
        answer.prompt.trim().length > 0 &&
        typeof answer.output === "string" &&
        answer.output.trim().length > 0
      );
    }
    return typeof answer.text === "string" && answer.text.trim().length > 0;
  }
  return false;
}

export function AssessmentAttemptClient({
  code,
  attemptId,
  payload,
  initialAnswers,
  meta,
  timeGuideMin,
  readOnly,
}: {
  code: string;
  attemptId: string;
  payload: LearnerAssessmentPayload;
  initialAnswers: SavedMap;
  meta: Record<string, unknown>;
  timeGuideMin: number | null;
  readOnly: boolean;
}) {
  const [activeSectionId, setActiveSectionId] = useState(payload.sections[0]?.id ?? "");
  const [answers, setAnswers] = useState<SavedMap>(initialAnswers);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [declaration, setDeclaration] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const started = useRef<number | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeSection = payload.sections.find((s) => s.id === activeSectionId) ?? payload.sections[0];

  const unanswered = useMemo(() => {
    const missing: string[] = [];
    for (const section of payload.sections) {
      for (const item of section.items) {
        if (item.type === "profile") {
          continue;
        }
        if (!isAnswered(item.type, answers[item.id])) {
          missing.push(`${section.title}: ${item.ref}`);
        }
      }
    }
    return missing;
  }, [answers, payload.sections]);

  const persist = useCallback(
    (itemId: string, answer: Record<string, unknown>) => {
      if (readOnly) {
        return;
      }
      setSaveState("saving");
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      debounceRef.current = setTimeout(() => {
        void saveAssessmentResponse({
          attemptId,
          itemId,
          answer: answer as Record<string, string | number | boolean | null>,
        }).then((result) => {
          setSaveState(result.ok ? "saved" : "error");
        });
      }, 400);
    },
    [attemptId, readOnly],
  );

  useEffect(() => {
    if (readOnly) {
      return;
    }
    started.current = Date.now();
    const tick = window.setInterval(() => {
      const base = started.current ?? Date.now();
      const seconds = Math.floor((Date.now() - base) / 1000);
      void updateAttemptSeconds({ attemptId, secondsActive: seconds });
    }, 60_000);
    return () => window.clearInterval(tick);
  }, [attemptId, readOnly]);

  const onSubmit = () => {
    setSubmitError(null);
    startTransition(async () => {
      const result = await submitAssessmentAttempt({
        attemptId,
        dataDeclaration: declaration,
        code,
      });
      if (!result.ok) {
        setSubmitError(result.error);
        return;
      }
      toast.success("Assessment submitted.");
      window.location.reload();
    });
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
      <nav className="space-y-1 text-sm" aria-label="Sections">
        {payload.sections.map((section) => {
          const answered = section.items.filter((item) => isAnswered(item.type, answers[item.id])).length;
          const total = section.items.filter((i) => i.type !== "profile").length;
          return (
            <button
              key={section.id}
              type="button"
              className={`block w-full rounded-md px-3 py-2 text-left ${
                section.id === activeSection?.id ? "bg-muted font-medium" : "hover:bg-muted/60"
              }`}
              onClick={() => setActiveSectionId(section.id)}
            >
              {section.title}
              <span className="mt-0.5 block text-xs text-muted-foreground">
                {answered}/{total} answered
              </span>
            </button>
          );
        })}
        {timeGuideMin ? (
          <p className="px-3 pt-4 text-xs text-muted-foreground">Guide time: about {timeGuideMin} minutes</p>
        ) : null}
        {!readOnly ? (
          <p className="px-3 text-xs text-muted-foreground" aria-live="polite">
            {saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved" : saveState === "error" ? "Save failed" : ""}
          </p>
        ) : null}
      </nav>

      <div className="space-y-6">
        {activeSection ? (
          <>
            <div>
              <h2 className="text-lg font-semibold">{activeSection.title}</h2>
              {activeSection.instructionsMd ? (
                <MarkdownView markdown={activeSection.instructionsMd} nested />
              ) : null}
            </div>
            {activeSection.items.map((item) => {
              const answer = answers[item.id] ?? {};
              const options = orderedOptions(item.id, item.options, meta);
              return (
                <article key={item.id} className="space-y-3 rounded-lg border p-4">
                  <p className="text-xs font-medium text-muted-foreground">{item.ref}</p>
                  <MarkdownView markdown={item.promptMd} nested />
                  {item.type === "choice" || item.type === "profile" ? (
                    <div className="space-y-2">
                      {options.map((opt) => (
                        <label key={opt.id} className="flex cursor-pointer items-start gap-2">
                          <input
                            type="radio"
                            name={item.id}
                            className="mt-1"
                            disabled={readOnly}
                            checked={answer.option_id === opt.id}
                            onChange={() => {
                              const next = { option_id: opt.id };
                              setAnswers((prev) => ({ ...prev, [item.id]: next }));
                              persist(item.id, next);
                            }}
                          />
                          <span>{opt.text}</span>
                        </label>
                      ))}
                    </div>
                  ) : null}
                  {item.type === "short_text" ? (
                    <Textarea
                      disabled={readOnly}
                      value={typeof answer.text === "string" ? answer.text : ""}
                      onChange={(event) => {
                        const next = { text: event.target.value, format: "text" };
                        setAnswers((prev) => ({ ...prev, [item.id]: next }));
                        persist(item.id, next);
                      }}
                      rows={4}
                    />
                  ) : null}
                  {item.type === "practical" ? (
                    <div className="space-y-3">
                      {item.responseFormat === "link" ? (
                        <Input
                          type="url"
                          disabled={readOnly}
                          placeholder="https://"
                          value={typeof answer.url === "string" ? answer.url : ""}
                          onChange={(event) => {
                            const next = { url: event.target.value, format: "link" };
                            setAnswers((prev) => ({ ...prev, [item.id]: next }));
                            persist(item.id, next);
                          }}
                        />
                      ) : item.responseFormat === "prompt_and_output" ? (
                        <>
                          <Textarea
                            disabled={readOnly}
                            placeholder="Your prompt"
                            value={typeof answer.prompt === "string" ? answer.prompt : ""}
                            onChange={(event) => {
                              const next = {
                                ...answer,
                                prompt: event.target.value,
                                format: "prompt_and_output",
                              };
                              setAnswers((prev) => ({ ...prev, [item.id]: next }));
                              persist(item.id, next);
                            }}
                          />
                          <Textarea
                            disabled={readOnly}
                            placeholder="Model output"
                            value={typeof answer.output === "string" ? answer.output : ""}
                            onChange={(event) => {
                              const next = {
                                ...answer,
                                output: event.target.value,
                                format: "prompt_and_output",
                              };
                              setAnswers((prev) => ({ ...prev, [item.id]: next }));
                              persist(item.id, next);
                            }}
                          />
                        </>
                      ) : (
                        <Textarea
                          disabled={readOnly}
                          value={typeof answer.text === "string" ? answer.text : ""}
                          onChange={(event) => {
                            const next = { text: event.target.value, format: "text" };
                            setAnswers((prev) => ({ ...prev, [item.id]: next }));
                            persist(item.id, next);
                          }}
                          rows={5}
                        />
                      )}
                    </div>
                  ) : null}
                </article>
              );
            })}
          </>
        ) : null}

        {!readOnly ? (
          <div className="space-y-4 border-t pt-6">
            <FormError>{submitError}</FormError>
            {unanswered.length > 0 ? (
              <p className="text-sm text-muted-foreground">
                {unanswered.length} scorable item{unanswered.length === 1 ? "" : "s"} still unanswered.
              </p>
            ) : null}
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                checked={declaration}
                onChange={(event) => setDeclaration(event.target.checked)}
              />
              <span>
                I confirm this work is my own and I understand how my answers will be used for placement.
              </span>
            </label>
            <Button
              type="button"
              disabled={!declaration || pending}
              onClick={() => setConfirmOpen(true)}
            >
              Submit assessment
            </Button>
            {confirmOpen ? (
              <div className="rounded-md border bg-muted/40 p-4 space-y-3">
                <p className="text-sm font-medium">Submit now?</p>
                <p className="text-sm text-muted-foreground">
                  You will not be able to change answers after submitting.
                </p>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={() => setConfirmOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="button" disabled={pending} onClick={onSubmit}>
                    Confirm submit
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
