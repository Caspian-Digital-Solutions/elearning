import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { requireUser } from "@/lib/auth";
import { loadDepartments } from "@/lib/people/directory";
import { loadTaskTypes } from "@/lib/prompts/queries";
import { promptLibraryClient } from "@/lib/prompts/db-client";
import { createClient } from "@/lib/supabase/server";
import { PromptEditor } from "../../prompt-editor";

export const metadata: Metadata = {
  title: "Edit prompt",
};

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const supabase = promptLibraryClient(await createClient());
  const { data: prompt } = await supabase.from("prompts").select("*").eq("id", id).maybeSingle();
  if (!prompt) {
    notFound();
  }

  const taskTypes = await loadTaskTypes();
  const departments = await loadDepartments();
  const { data: modules } = await supabase.from("modules").select("id, code, title").order("code");
  const canSubmit = user.role === "champion" || user.actualRole === "trainer" || user.actualRole === "admin";

  return (
    <>
      <PageHeader title={prompt.title} purpose={`Status: ${String(prompt.status).replaceAll("_", " ")}`} />
      <PromptEditor
        promptId={prompt.id}
        taskTypes={taskTypes}
        departments={departments.map((d) => ({ id: d.id, name: d.name }))}
        modules={(modules ?? []).map((m) => ({ id: m.id, label: `${m.code} — ${m.title}` }))}
        canSubmitForReview={canSubmit}
        initial={{
          title: prompt.title,
          slug: prompt.slug,
          body: prompt.body,
          taskType: prompt.task_type,
          tool: prompt.tool,
          riskTier: prompt.risk_tier,
          departmentId: prompt.department_id,
          moduleId: prompt.module_id,
          usageNotesMd: prompt.usage_notes_md,
          exampleMd: prompt.example_md,
          status: prompt.status,
        }}
      />
    </>
  );
}
