"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { FormError } from "@/components/shared/form-error";
import { MarkdownView } from "@/components/shared/markdown-view";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LessonImportDialog } from "@/app/(app)/trainer/(restricted)/content/lesson-import-dialog";
import {
  reorderLessons,
  updateModuleOverview,
} from "@/app/(app)/trainer/(restricted)/content/lesson-actions";
import { formatDateTime } from "@/lib/format";

type LessonRow = {
  id: string;
  title: string;
  slug: string;
  status: string;
  kind: string;
  duration_min: number | null;
};

type Revision = {
  revisionNo: number;
  publishedAt: string;
  publisher: string;
  changeNote: string;
};

export function ModuleTrainerScreen({
  moduleId,
  code,
  title,
  stageName,
  overviewMd,
  lessons: initialLessons,
  revisions,
}: {
  moduleId: string;
  code: string;
  title: string;
  stageName: string;
  overviewMd: string;
  lessons: LessonRow[];
  revisions: Revision[];
}) {
  const router = useRouter();
  const [overview, setOverview] = useState(overviewMd);
  const [changeNote, setChangeNote] = useState("");
  const [lessons, setLessons] = useState(initialLessons);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const saveOverview = async () => {
    setSaving(true);
    setError(null);
    const result = await updateModuleOverview({ moduleId, bodyMd: overview, changeNote });
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    toast.success("Module overview saved.");
    router.refresh();
  };

  const move = async (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= lessons.length) {
      return;
    }
    const next = [...lessons];
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item);
    setLessons(next);
    const result = await reorderLessons({ moduleId, lessonIds: next.map((row) => row.id) });
    if (!result.ok) {
      setError(result.error);
      setLessons(initialLessons);
      return;
    }
    toast.success("Lesson order updated.");
    router.refresh();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${code} — ${title}`}
        purpose={`${stageName} module overview and lesson order.`}
      />
      <div className="flex flex-wrap gap-2">
        <Button render={<Link href="/trainer/content?tab=lessons" />}>Back to lessons</Button>
        <LessonImportDialog />
      </div>
      <FormError>{error}</FormError>
      <section className="space-y-3 rounded-lg border border-border p-4">
        <h2 className="font-heading text-lg text-heading">Module overview</h2>
        <Textarea
          value={overview}
          onChange={(event) => setOverview(event.target.value)}
          className="min-h-[200px] font-mono text-sm"
          aria-label="Module overview markdown"
        />
        <div className="space-y-2">
          <Label htmlFor="overview-note">Change note</Label>
          <input
            id="overview-note"
            className="w-full rounded-lg border border-border px-3 py-2 text-sm"
            value={changeNote}
            onChange={(event) => setChangeNote(event.target.value)}
          />
        </div>
        <Button type="button" disabled={saving} onClick={() => void saveOverview()}>
          Save overview
        </Button>
        <div className="rounded-lg border border-border bg-surface p-4">
          <p className="mb-2 text-sm font-medium">Preview</p>
          <MarkdownView markdown={overview || "_No overview yet._"} nested />
        </div>
        {revisions.length > 0 ? (
          <ul className="space-y-1 text-sm text-muted">
            {revisions.map((rev) => (
              <li key={rev.revisionNo}>
                v{rev.revisionNo} · {formatDateTime(rev.publishedAt)} · {rev.publisher} · {rev.changeNote}
              </li>
            ))}
          </ul>
        ) : null}
      </section>
      <section className="space-y-3">
        <h2 className="font-heading text-lg text-heading">Lessons in this module</h2>
        <ul className="space-y-2">
          {lessons.map((lesson, index) => (
            <li
              key={lesson.id}
              className="flex flex-wrap items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm"
            >
              <span className="font-medium">{lesson.title}</span>
              <span className="text-muted">{lesson.status}</span>
              <Button size="sm" variant="outline" render={<Link href={`/trainer/content/lessons/${lesson.id}`} />}>
                Edit
              </Button>
              <Button type="button" size="sm" variant="outline" disabled={index === 0} onClick={() => void move(index, -1)}>
                Move up
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={index === lessons.length - 1}
                onClick={() => void move(index, 1)}
              >
                Move down
              </Button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
