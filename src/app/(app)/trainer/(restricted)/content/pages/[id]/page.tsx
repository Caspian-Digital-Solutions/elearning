import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { requireRole } from "@/lib/auth";
import { loadOwnerOptions, loadPageEditorData } from "@/lib/content/trainer-load";
import { PageEditor } from "@/app/(app)/trainer/(restricted)/content/page-editor";

export const metadata: Metadata = {
  title: "Edit help page",
};

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await requireRole(["trainer", "admin"]);
  const { id } = await params;
  const [owners, data] = await Promise.all([loadOwnerOptions(), loadPageEditorData(id)]);
  if (!data) {
    notFound();
  }
  return (
    <div className="space-y-6">
      <PageHeader title="Edit help page" purpose={data.initial.title} />
      <PageEditor
        pageId={data.pageId}
        owners={owners}
        revisions={data.revisions}
        pendingPeople={data.pendingPeople}
        initial={data.initial}
      />
    </div>
  );
}
