"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MarkdownEditor } from "@/components/content/markdown-editor";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { FormError } from "@/components/shared/form-error";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import {
  publishLesson,
  restoreLessonRevision,
  saveLessonDraft,
  unpublishLesson,
} from "@/app/(app)/trainer/(restricted)/content/lesson-actions";
import { uploadContentImage } from "@/app/(app)/trainer/(restricted)/content/image-actions";
import { slugifyTitle } from "@/lib/content/slug";
import { formatDateTime } from "@/lib/format";
import type { ModuleOption } from "@/lib/lessons/queries";

type Resource = { title: string; url: string };

type Revision = {
  revisionNo: number;
  publishedAt: string;
  publisher: string;
  changeNote: string;
  title: string;
  bodyMd: string;
};

type Department = { id: string; name: string };

export function LessonEditor({
  lessonId,
  modules,
  departments,
  initial,
  revisions,
}: {
  lessonId?: string;
  modules: ModuleOption[];
  departments: Department[];
  initial: {
    moduleId: string;
    title: string;
    slug: string;
    bodyMd: string;
    summary: string;
    kind: "lesson" | "recording" | "worked_example";
    durationMin: number;
    videoUrl: string;
    resources: Resource[];
    departmentIds: string[];
    sortOrder: number;
    version: number;
    publishedAt: string | null;
    slugLocked: boolean;
  };
  revisions: Revision[];
}) {
  const router = useRouter();
  const [moduleId, setModuleId] = useState(initial.moduleId);
  const [title, setTitle] = useState(initial.title);
  const [slug, setSlug] = useState(initial.slug);
  const [body, setBody] = useState(initial.bodyMd);
  const [summary, setSummary] = useState(initial.summary);
  const [kind, setKind] = useState(initial.kind);
  const [durationMin, setDurationMin] = useState(String(initial.durationMin || 10));
  const [videoUrl, setVideoUrl] = useState(initial.videoUrl);
  const [resources, setResources] = useState<Resource[]>(initial.resources);
  const [allDepartments, setAllDepartments] = useState(initial.departmentIds.length === 0);
  const [departmentIds, setDepartmentIds] = useState<string[]>(initial.departmentIds);
  const [sortOrder, setSortOrder] = useState(String(initial.sortOrder));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [changeNote, setChangeNote] = useState("");
  const [viewRevision, setViewRevision] = useState<Revision | null>(null);

  const versionLabel = useMemo(() => {
    const next = initial.publishedAt ? initial.version + 1 : 1;
    return `Version ${initial.version} → ${next}`;
  }, [initial.publishedAt, initial.version]);

  const stages = useMemo(() => {
    const map = new Map<string, ModuleOption[]>();
    for (const mod of modules) {
      const list = map.get(mod.stageName) ?? [];
      list.push(mod);
      map.set(mod.stageName, list);
    }
    return [...map.entries()].sort((a, b) => {
      const sortA = a[1][0]?.stageSort ?? 0;
      const sortB = b[1][0]?.stageSort ?? 0;
      return sortA - sortB;
    });
  }, [modules]);

  const payload = () => ({
    id: lessonId,
    moduleId,
    title,
    slug: slug || slugifyTitle(title),
    bodyMd: body,
    summary,
    kind,
    durationMin: Number(durationMin) || 10,
    videoUrl,
    resources,
    departmentIds: allDepartments ? [] : departmentIds,
    sortOrder: Number(sortOrder) || 0,
  });

  const save = async () => {
    setSaving(true);
    setError(null);
    const result = await saveLessonDraft(payload());
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    toast.success("Draft saved.");
    if (!lessonId) {
      router.replace(`/trainer/content/lessons/${result.data.id}`);
    }
  };

  const publish = async () => {
    setSaving(true);
    setError(null);
    const saved = await saveLessonDraft(payload());
    if (!saved.ok) {
      setSaving(false);
      setError(saved.error);
      return;
    }
    const id = saved.data.id;
    const result = await publishLesson({ id, changeNote });
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    toast.success(`Published as version ${result.data.version}.`);
    setPublishOpen(false);
    router.refresh();
  };

  const toggleDepartment = (id: string) => {
    setDepartmentIds((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );
  };

  return (
    <div className="space-y-4">
      <FormError>{error}</FormError>
      <MarkdownEditor
        title={title}
        body={body}
        onTitleChange={(value) => {
          setTitle(value);
          if (!initial.slugLocked && !slug) {
            setSlug(slugifyTitle(value));
          }
        }}
        onBodyChange={setBody}
        onSaveDraft={save}
        onPublish={() => setPublishOpen(true)}
        publishVersionLabel={versionLabel}
        saving={saving}
        imageUpload={
          lessonId
            ? { contentId: lessonId, folder: "lessons", upload: uploadContentImage }
            : undefined
        }
        extraFields={
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="lesson-module">Module</Label>
              <NativeSelect
                id="lesson-module"
                value={moduleId}
                onChange={(event) => setModuleId(event.target.value)}
              >
                <option value="">Choose module</option>
                {stages.map(([stageName, mods]) => (
                  <optgroup key={stageName} label={stageName}>
                    {mods.map((mod) => (
                      <option key={mod.id} value={mod.id}>
                        {mod.code} — {mod.title}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </NativeSelect>
            </div>
            <div className="space-y-2">
              <Label htmlFor="lesson-slug">Slug</Label>
              <input
                id="lesson-slug"
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm disabled:opacity-60"
                value={slug}
                disabled={initial.slugLocked}
                onChange={(event) => setSlug(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lesson-kind">Kind</Label>
              <NativeSelect id="lesson-kind" value={kind} onChange={(event) => setKind(event.target.value as typeof kind)}>
                <option value="lesson">Lesson</option>
                <option value="recording">Recording</option>
                <option value="worked_example">Worked example</option>
              </NativeSelect>
            </div>
            <div className="space-y-2">
              <Label htmlFor="lesson-duration">Duration (minutes)</Label>
              <input
                id="lesson-duration"
                type="number"
                min={1}
                max={60}
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
                value={durationMin}
                onChange={(event) => setDurationMin(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lesson-order">Order in module</Label>
              <input
                id="lesson-order"
                type="number"
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
                value={sortOrder}
                onChange={(event) => setSortOrder(event.target.value)}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="lesson-summary">Summary</Label>
              <textarea
                id="lesson-summary"
                maxLength={300}
                rows={2}
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
                value={summary}
                onChange={(event) => setSummary(event.target.value)}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="lesson-video">Video link</Label>
              <input
                id="lesson-video"
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
                value={videoUrl}
                onChange={(event) => setVideoUrl(event.target.value)}
                placeholder="https://drive.google.com/... or YouTube"
              />
              <p className="text-xs text-muted">
                Share the file with Caspian Digital Solutions (anyone in the organisation with the link) or learners
                will see a Google sign-in box.
              </p>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Departments</Label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={allDepartments}
                  onChange={(event) => setAllDepartments(event.target.checked)}
                />
                All departments (Everyone)
              </label>
              {!allDepartments ? (
                <ul className="grid gap-1 sm:grid-cols-2">
                  {departments.map((dep) => (
                    <li key={dep.id}>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={departmentIds.includes(dep.id)}
                          onChange={() => toggleDepartment(dep.id)}
                        />
                        {dep.name}
                      </label>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Resources</Label>
              {resources.map((resource, index) => (
                <div key={index} className="mb-2 flex flex-wrap gap-2">
                  <input
                    className="min-w-[8rem] flex-1 rounded-lg border border-border px-2 py-1 text-sm"
                    placeholder="Title"
                    value={resource.title}
                    onChange={(event) => {
                      const next = [...resources];
                      next[index] = { ...next[index], title: event.target.value };
                      setResources(next);
                    }}
                  />
                  <input
                    className="min-w-[12rem] flex-[2] rounded-lg border border-border px-2 py-1 text-sm"
                    placeholder="https://"
                    value={resource.url}
                    onChange={(event) => {
                      const next = [...resources];
                      next[index] = { ...next[index], url: event.target.value };
                      setResources(next);
                    }}
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setResources(resources.filter((_, i) => i !== index))}
                  >
                    Remove
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setResources([...resources, { title: "", url: "" }])}
              >
                Add resource
              </Button>
            </div>
          </div>
        }
        historyPanel={
          <div className="space-y-3 rounded-lg border border-border p-4">
            <h3 className="font-heading text-base text-heading">History</h3>
            {revisions.length === 0 ? (
              <p className="text-sm text-muted">No published revisions yet.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {revisions.map((rev) => (
                  <li key={rev.revisionNo} className="flex flex-wrap items-center gap-2 border-b border-border pb-2">
                    <span>Version {rev.revisionNo}</span>
                    <span className="text-muted">
                      {formatDateTime(rev.publishedAt)} · {rev.publisher}
                    </span>
                    <span className="text-muted">{rev.changeNote}</span>
                    <Button type="button" size="sm" variant="outline" onClick={() => setViewRevision(rev)}>
                      View
                    </Button>
                    {lessonId ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          void restoreLessonRevision({ id: lessonId, revisionNo: rev.revisionNo }).then((res) => {
                            if (res.ok) {
                              toast.success("Revision restored to draft.");
                              router.refresh();
                            } else {
                              setError(res.error);
                            }
                          })
                        }
                      >
                        Restore to draft
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        }
      />
      {lessonId && initial.publishedAt ? (
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            void unpublishLesson({ id: lessonId, reason: "Archived from the editor" }).then((res) => {
              if (res.ok) {
                toast.success("Lesson archived.");
                router.refresh();
              } else {
                setError(res.error);
              }
            })
          }
        >
          Unpublish
        </Button>
      ) : null}
      <ConfirmDialog
        open={publishOpen}
        onOpenChange={setPublishOpen}
        title="Publish this lesson"
        description={versionLabel}
        confirmLabel="Publish"
        closeOnConfirm={false}
        onConfirm={publish}
      >
        <div className="space-y-2">
          <Label htmlFor="lesson-change-note">Change note</Label>
          <textarea
            id="lesson-change-note"
            className="w-full rounded-lg border border-border px-3 py-2 text-sm"
            rows={3}
            value={changeNote}
            onChange={(event) => setChangeNote(event.target.value)}
          />
        </div>
      </ConfirmDialog>
      {viewRevision ? (
        <div className="rounded-lg border border-border p-4 text-sm">
          <p className="mb-2 font-medium">Version {viewRevision.revisionNo}</p>
          <pre className="whitespace-pre-wrap">{viewRevision.bodyMd}</pre>
          <Button type="button" className="mt-2" variant="outline" onClick={() => setViewRevision(null)}>
            Close
          </Button>
        </div>
      ) : null}
    </div>
  );
}
