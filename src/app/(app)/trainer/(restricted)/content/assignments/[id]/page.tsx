import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { requireRole } from "@/lib/auth";
import { loadAssignmentEditor } from "@/app/(app)/trainer/(restricted)/content/assignment-actions";
import { AssignmentEditor } from "@/app/(app)/trainer/(restricted)/content/assignment-editor";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Edit assignment",
};

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await requireRole(["trainer", "admin"]);
  const { id } = await params;
  const initial = await loadAssignmentEditor(id);
  if (!initial) {
    notFound();
  }
  const supabase = await createClient();
  const [{ data: modules }, { data: rubrics }, { data: departments }] = await Promise.all([
    supabase.from("modules").select("id, code, title").order("code"),
    supabase.from("rubrics").select("id, ref, title").order("ref"),
    supabase.from("departments").select("id, name").eq("is_active", true).order("name"),
  ]);
  return (
    <div className="space-y-6">
      <PageHeader title="Edit assignment" purpose={initial.title} />
      <AssignmentEditor
        initial={initial}
        modules={modules ?? []}
        rubrics={rubrics ?? []}
        departments={departments ?? []}
      />
    </div>
  );
}
