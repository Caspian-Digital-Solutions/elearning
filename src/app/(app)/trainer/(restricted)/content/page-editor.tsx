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
  publishPage,
  restorePageRevision,
  savePageDraft,
  unpublishPage,
} from "@/app/(app)/trainer/(restricted)/content/actions";
import { slugifyTitle } from "@/lib/content/slug";
import { formatDateTime } from "@/lib/format";

type OwnerOption = { id: string; name: string };

type Revision = {
  revisionNo: number;
  publishedAt: string;
  publisher: string;
  changeNote: string;
  title: string;
  bodyMd: string;
};

export function PageEditor({
  pageId,
  initial,
  owners,
  revisions,
  pendingPeople,
}: {
  pageId?: string;
  initial: {
    title: string;
    slug: string;
    bodyMd: string;
    ownerId: string | null;
    reviewBy: string;
    requiresAcknowledgement: boolean;
    sortOrder: number;
    version: number;
    publishedAt: string | null;
    slugLocked: boolean;
  };
  owners: OwnerOption[];
  revisions: Revision[];
  pendingPeople: { name: string; department: string; lastSeen: string }[];
}) {
  const router = useRouter();
  const [title, setTitle] = useState(initial.title);
  const [slug, setSlug] = useState(initial.slug);
  const [body, setBody] = useState(initial.bodyMd);
  const [ownerId, setOwnerId] = useState(initial.ownerId ?? "");
  const [reviewBy, setReviewBy] = useState(initial.reviewBy);
  const [requiresAck, setRequiresAck] = useState(initial.requiresAcknowledgement);
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

  const save = async () => {
    setSaving(true);
    setError(null);
    const result = await savePageDraft({
      id: pageId,
      title,
      slug: slug || slugifyTitle(title),
      bodyMd: body,
      ownerId: ownerId || null,
      reviewBy,
      requiresAcknowledgement: requiresAck,
      sortOrder: Number(sortOrder) || 0,
    });
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    toast.success("Draft saved.");
    if (!pageId) {
      router.replace(`/trainer/content/pages/${result.data.id}`);
    }
  };

  const publish = async () => {
    setSaving(true);
    setError(null);
    const saved = await savePageDraft({
      id: pageId,
      title,
      slug: slug || slugifyTitle(title),
      bodyMd: body,
      ownerId: ownerId || null,
      reviewBy,
      requiresAcknowledgement: requiresAck,
      sortOrder: Number(sortOrder) || 0,
    });
    if (!saved.ok) {
      setSaving(false);
      setError(saved.error);
      return;
    }
    const id = saved.data.id;
    const result = await publishPage({ id, changeNote });
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
              <Label htmlFor="page-slug">Slug</Label>
              <input
                id="page-slug"
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm disabled:opacity-60"
                value={slug}
                disabled={initial.slugLocked}
                onChange={(event) => setSlug(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="page-owner">Owner</Label>
              <NativeSelect
                id="page-owner"
                value={ownerId}
                onChange={(event) => setOwnerId(event.target.value)}
              >
                <option value="">No owner</option>
                {owners.map((owner) => (
                  <option key={owner.id} value={owner.id}>{owner.name}</option>
                ))}
              </NativeSelect>
            </div>
            <div className="space-y-2">
              <Label htmlFor="page-review">Review by</Label>
              <input
                id="page-review"
                type="date"
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
                value={reviewBy}
                onChange={(event) => setReviewBy(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="page-order">Order</Label>
              <input
                id="page-order"
                type="number"
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
                value={sortOrder}
                onChange={(event) => setSortOrder(event.target.value)}
              />
            </div>
            <label className="flex items-center gap-2 text-sm md:col-span-2">
              <input
                type="checkbox"
                checked={requiresAck}
                onChange={(event) => setRequiresAck(event.target.checked)}
              />
              People must confirm they have read this
            </label>
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
                    <span className="text-muted">{formatDateTime(rev.publishedAt)} · {rev.publisher}</span>
                    <span className="text-muted">{rev.changeNote}</span>
                    <Button type="button" size="sm" variant="outline" onClick={() => setViewRevision(rev)}>
                      View
                    </Button>
                    {pageId ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          void restorePageRevision({ id: pageId, revisionNo: rev.revisionNo }).then((res) => {
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
            {requiresAck && pendingPeople.length > 0 ? (
              <div className="space-y-2">
                <h4 className="font-medium">Not yet confirmed</h4>
                <ul className="text-sm">
                  {pendingPeople.map((person) => (
                    <li key={person.name}>{person.name} · {person.department} · last seen {person.lastSeen}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        }
      />
      {pageId && initial.publishedAt ? (
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            void unpublishPage({ id: pageId, reason: "Archived from the editor" }).then((res) => {
              if (res.ok) {
                toast.success("Page archived.");
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
        title="Publish this page"
        description={versionLabel}
        confirmLabel="Publish"
        closeOnConfirm={false}
        onConfirm={publish}
      >
        <div className="space-y-2">
          <Label htmlFor="change-note">Change note</Label>
          <textarea
            id="change-note"
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
