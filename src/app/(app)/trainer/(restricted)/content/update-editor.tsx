"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MarkdownEditor } from "@/components/content/markdown-editor";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { FormError } from "@/components/shared/form-error";
import { Label } from "@/components/ui/label";
import {
  publishUpdate,
  restoreUpdateRevision,
  saveUpdateDraft,
} from "@/app/(app)/trainer/(restricted)/content/actions";
import { slugifyTitle } from "@/lib/content/slug";
import { updateTools } from "@/lib/content/tools";
import { formatDateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";

type Revision = {
  revisionNo: number;
  publishedAt: string;
  publisher: string;
  changeNote: string;
  bodyMd: string;
};

export function UpdateEditor({
  updateId,
  initial,
  revisions,
}: {
  updateId?: string;
  initial: {
    title: string;
    slug: string;
    bodyMd: string;
    tools: string[];
    actionRequired: boolean;
    actionText: string;
    actionDue: string;
    version: number;
    publishedAt: string | null;
    slugLocked: boolean;
  };
  revisions: Revision[];
}) {
  const router = useRouter();
  const [title, setTitle] = useState(initial.title);
  const [slug, setSlug] = useState(initial.slug);
  const [body, setBody] = useState(initial.bodyMd);
  const [tools, setTools] = useState<string[]>(initial.tools);
  const [actionRequired, setActionRequired] = useState(initial.actionRequired);
  const [actionText, setActionText] = useState(initial.actionText);
  const [actionDue, setActionDue] = useState(initial.actionDue);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [changeNote, setChangeNote] = useState("");

  const versionLabel = useMemo(() => {
    const next = initial.publishedAt ? initial.version + 1 : 1;
    return `Version ${initial.version} → ${next}`;
  }, [initial.publishedAt, initial.version]);

  const toggleTool = (tool: string) => {
    setTools((current) =>
      current.includes(tool) ? current.filter((t) => t !== tool) : [...current, tool],
    );
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    const result = await saveUpdateDraft({
      id: updateId,
      title,
      slug: slug || slugifyTitle(title),
      bodyMd: body,
      tools,
      actionRequired,
      actionText,
      actionDue,
    });
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    toast.success("Draft saved.");
    if (!updateId) {
      router.replace(`/trainer/content/updates/${result.data.id}`);
    }
  };

  const publish = async () => {
    setSaving(true);
    setError(null);
    const saved = await saveUpdateDraft({
      id: updateId,
      title,
      slug: slug || slugifyTitle(title),
      bodyMd: body,
      tools,
      actionRequired,
      actionText,
      actionDue,
    });
    if (!saved.ok) {
      setSaving(false);
      setError(saved.error);
      return;
    }
    const id = saved.data.id;
    const result = await publishUpdate({ id, changeNote });
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    toast.success(`Published as version ${result.data.version}.`);
    setPublishOpen(false);
    router.refresh();
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
        extraFields={
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="update-slug">Slug</Label>
              <input
                id="update-slug"
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm disabled:opacity-60"
                value={slug}
                disabled={initial.slugLocked}
                onChange={(event) => setSlug(event.target.value)}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Tools</Label>
              <div className="flex flex-wrap gap-2">
                {updateTools.map((tool) => (
                  <label key={tool} className="flex items-center gap-1 text-sm">
                    <input
                      type="checkbox"
                      checked={tools.includes(tool)}
                      onChange={() => toggleTool(tool)}
                    />
                    {tool}
                  </label>
                ))}
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm md:col-span-2">
              <input
                type="checkbox"
                checked={actionRequired}
                onChange={(event) => setActionRequired(event.target.checked)}
              />
              Action required
            </label>
            {actionRequired ? (
              <>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="action-text">Action text</Label>
                  <textarea
                    id="action-text"
                    className="w-full rounded-lg border border-border px-3 py-2 text-sm"
                    rows={2}
                    value={actionText}
                    onChange={(event) => setActionText(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="action-due">Action due</Label>
                  <input
                    id="action-due"
                    type="date"
                    className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
                    value={actionDue}
                    onChange={(event) => setActionDue(event.target.value)}
                  />
                </div>
              </>
            ) : null}
          </div>
        }
        historyPanel={
          revisions.length ? (
            <ul className="space-y-2 text-sm">
              {revisions.map((rev) => (
                <li key={rev.revisionNo} className="flex flex-wrap gap-2">
                  <span>Version {rev.revisionNo}</span>
                  <span className="text-muted">{formatDateTime(rev.publishedAt)}</span>
                  {updateId ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        void restoreUpdateRevision({ id: updateId, revisionNo: rev.revisionNo }).then((res) => {
                          if (res.ok) {
                            toast.success("Revision restored to draft.");
                            router.refresh();
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
          ) : null
        }
      />
      <ConfirmDialog
        open={publishOpen}
        onOpenChange={setPublishOpen}
        title="Publish this update"
        description={versionLabel}
        confirmLabel="Publish"
        closeOnConfirm={false}
        onConfirm={publish}
      >
        <textarea
          className="w-full rounded-lg border border-border px-3 py-2 text-sm"
          rows={3}
          placeholder="Change note"
          value={changeNote}
          onChange={(event) => setChangeNote(event.target.value)}
        />
      </ConfirmDialog>
    </div>
  );
}
