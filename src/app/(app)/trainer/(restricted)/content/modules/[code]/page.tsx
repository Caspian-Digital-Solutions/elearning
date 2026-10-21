import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { loadModuleTrainerView } from "@/lib/lessons/trainer-load-lessons";
import { ModuleTrainerScreen } from "@/app/(app)/trainer/(restricted)/content/module-trainer-screen";

export const metadata: Metadata = {
  title: "Module lessons",
};

export default async function Page({ params }: { params: Promise<{ code: string }> }) {
  await requireRole(["trainer", "admin"]);
  const { code } = await params;
  const data = await loadModuleTrainerView(code);
  if (!data) {
    notFound();
  }
  const stage = data.module.stages as { name: string } | null;
  return (
    <ModuleTrainerScreen
      moduleId={data.module.id}
      code={data.module.code}
      title={data.module.title}
      stageName={stage?.name ?? "—"}
      overviewMd={data.module.overview_md}
      lessons={data.lessons}
      revisions={data.revisions}
    />
  );
}
