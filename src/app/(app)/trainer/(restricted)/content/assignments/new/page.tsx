import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { requireRole } from "@/lib/auth";
import { AssignmentImportDialog } from "@/app/(app)/trainer/(restricted)/content/assignment-import-dialog";

export const metadata: Metadata = {
  title: "New assignment",
};

export default async function Page() {
  await requireRole(["trainer", "admin"]);
  return (
    <div className="space-y-6">
      <PageHeader
        title="New assignment"
        purpose="Import a JSON draft or duplicate an existing assignment from Content › Assignments."
      />
      <AssignmentImportDialog />
    </div>
  );
}
