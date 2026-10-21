import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { requireRole } from "@/lib/auth";
import { loadActiveDepartments, loadModuleOptions } from "@/lib/lessons/queries";
import { loadLessonEditorData } from "@/lib/lessons/trainer-load-lessons";
import { LessonEditor } from "@/app/(app)/trainer/(restricted)/content/lesson-editor";

export const metadata: Metadata = {
  title: "Edit lesson",
};

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await requireRole(["trainer", "admin"]);
  const { id } = await params;
  const [modules, departments, data] = await Promise.all([
    loadModuleOptions(),
    loadActiveDepartments(),
    loadLessonEditorData(id),
  ]);
  if (!data) {
    notFound();
  }
  return (
    <div className="space-y-6">
      <PageHeader title="Edit lesson" purpose={data.initial.title} />
      <LessonEditor
        lessonId={data.lessonId}
        modules={modules}
        departments={departments.map((d) => ({ id: d.id, name: d.name }))}
        revisions={data.revisions}
        initial={data.initial}
      />
    </div>
  );
}
