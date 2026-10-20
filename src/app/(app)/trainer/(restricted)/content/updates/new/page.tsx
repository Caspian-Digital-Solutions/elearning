import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { requireRole } from "@/lib/auth";
import { UpdateEditor } from "@/app/(app)/trainer/(restricted)/content/update-editor";

export const metadata: Metadata = {
  title: "New update",
};

export default async function Page() {
  await requireRole(["trainer", "admin"]);
  return (
    <div className="space-y-6">
      <PageHeader title="New update" purpose="Write a What changed note for staff." />
      <UpdateEditor
        revisions={[]}
        initial={{
          title: "",
          slug: "",
          bodyMd: "",
          tools: [],
          actionRequired: false,
          actionText: "",
          actionDue: "",
          version: 1,
          publishedAt: null,
          slugLocked: false,
        }}
      />
    </div>
  );
}
