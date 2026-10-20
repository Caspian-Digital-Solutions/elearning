import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { requireRole } from "@/lib/auth";
import { loadUpdateEditorData } from "@/lib/content/trainer-load";
import { UpdateEditor } from "@/app/(app)/trainer/(restricted)/content/update-editor";

export const metadata: Metadata = {
  title: "Edit update",
};

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await requireRole(["trainer", "admin"]);
  const { id } = await params;
  const data = await loadUpdateEditorData(id);
  if (!data) {
    notFound();
  }
  return (
    <div className="space-y-6">
      <PageHeader title="Edit update" purpose={data.initial.title} />
      <UpdateEditor updateId={data.updateId} initial={data.initial} revisions={data.revisions} />
    </div>
  );
}
