import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { requireRole } from "@/lib/auth";
import { loadActiveDepartments, loadModuleOptions } from "@/lib/lessons/queries";
import { LessonEditor } from "@/app/(app)/trainer/(restricted)/content/lesson-editor";

export const metadata: Metadata = {
  title: "New lesson",
};

export default async function Page() {
  await requireRole(["trainer", "admin"]);
  const [modules, departments] = await Promise.all([loadModuleOptions(), loadActiveDepartments()]);
  const firstModule = modules[0]?.id ?? "";
  return (
    <div className="space-y-6">
      <PageHeader title="New lesson" purpose="Write the lesson, save a draft, then publish when it is ready." />
      <LessonEditor
        modules={modules}
        departments={departments.map((d) => ({ id: d.id, name: d.name }))}
        revisions={[]}
        initial={{
          moduleId: firstModule,
          title: "",
          slug: "",
          bodyMd: "",
          summary: "",
          kind: "lesson",
          durationMin: 10,
          videoUrl: "",
          resources: [],
          departmentIds: [],
          sortOrder: 0,
          version: 1,
          publishedAt: null,
          slugLocked: false,
        }}
      />
    </div>
  );
}
