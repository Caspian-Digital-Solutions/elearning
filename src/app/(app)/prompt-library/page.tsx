import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { sections } from "@/config/navigation";
import { requireUser } from "@/lib/auth";
import { loadDepartments } from "@/lib/people/directory";
import { loadLearnerPrompts, loadTaskTypes } from "@/lib/prompts/queries";
import { createClient } from "@/lib/supabase/server";
import { PromptLibraryScreen } from "./prompt-library-screen";

export const metadata: Metadata = {
  title: "Prompt library",
};

export default async function Page() {
  const user = await requireUser();
  const taskTypes = await loadTaskTypes();
  const departments = await loadDepartments();
  const supabase = await createClient();
  const { data: modules } = await supabase
    .from("modules")
    .select("id, code, title")
    .order("code");
  const prompts = await loadLearnerPrompts({
    userDepartmentId: user.departmentId,
  });

  return (
    <>
      <PageHeader title={sections.promptLibrary.title} purpose={sections.promptLibrary.purpose} />
      <PromptLibraryScreen
        prompts={prompts}
        taskTypes={taskTypes}
        departments={departments.map((d) => ({ id: d.id, name: d.name }))}
        modules={(modules ?? []).map((m) => ({ id: m.id, label: `${m.code} — ${m.title}` }))}
      />
    </>
  );
}
