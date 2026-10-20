import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { requireRole } from "@/lib/auth";
import { loadOwnerOptions } from "@/lib/content/trainer-load";
import { PageEditor } from "@/app/(app)/trainer/(restricted)/content/page-editor";

export const metadata: Metadata = {
  title: "New help page",
};

export default async function Page() {
  await requireRole(["trainer", "admin"]);
  const owners = await loadOwnerOptions();
  return (
    <div className="space-y-6">
      <PageHeader title="New help page" purpose="Write the page, save a draft, then publish when it is ready." />
      <PageEditor
        owners={owners}
        revisions={[]}
        pendingPeople={[]}
        initial={{
          title: "",
          slug: "",
          bodyMd: "",
          ownerId: null,
          reviewBy: "",
          requiresAcknowledgement: false,
          sortOrder: 0,
          version: 1,
          publishedAt: null,
          slugLocked: false,
        }}
      />
    </div>
  );
}
