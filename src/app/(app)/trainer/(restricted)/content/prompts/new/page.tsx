import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { requireUser } from "@/lib/auth";
import { loadDepartments } from "@/lib/people/directory";
import { loadTaskTypes } from "@/lib/prompts/queries";
import { createClient } from "@/lib/supabase/server";
import { PromptEditor } from "../../prompt-editor";

export const metadata: Metadata = {
  title: "New prompt",
};

export default async function Page() {
  const user = await requireUser();
  const taskTypes = await loadTaskTypes();
  const departments = await loadDepartments();
  const supabase = await createClient();
  const { data: modules } = await supabase.from("modules").select("id, code, title").order("code");
  const canSubmit = user.role === "champion" || user.actualRole === "trainer" || user.actualRole === "admin";

  return (
    <>
      <PageHeader title="New prompt" purpose="Draft a prompt for review." />
      <PromptEditor
        taskTypes={taskTypes}
        departments={departments.map((d) => ({ id: d.id, name: d.name }))}
        modules={(modules ?? []).map((m) => ({ id: m.id, label: `${m.code} — ${m.title}` }))}
        canSubmitForReview={canSubmit}
        initial={{
          title: "",
          slug: "",
          body: "",
          taskType: taskTypes[0] ?? "drafting",
          tool: "claude",
          riskTier: "low",
          departmentId: user.departmentId,
          moduleId: null,
          usageNotesMd: "",
          exampleMd: "",
          status: "draft",
        }}
      />
    </>
  );
}
