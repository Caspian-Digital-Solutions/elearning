import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { requireRole } from "@/lib/auth";
import { loadMinTestCases, loadSkillVersions } from "@/lib/skills/queries";
import { skillsCatalogueClient } from "@/lib/skills/db-client";
import { createClient } from "@/lib/supabase/server";
import type { SkillRow } from "@/lib/skills/types";
import { SkillEditor } from "./skill-editor";

export const metadata: Metadata = {
  title: "Edit Skill",
};

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await requireRole(["trainer", "admin", "champion"]);
  const { id } = await params;
  const supabase = skillsCatalogueClient(await createClient());
  const { data } = await supabase.from("skills").select("*").eq("id", id).maybeSingle();
  const skill = data as SkillRow | null;
  if (!skill) {
    notFound();
  }
  const [versions, minTestCases] = await Promise.all([loadSkillVersions(skill.id), loadMinTestCases()]);

  return (
    <div className="space-y-6">
      <PageHeader title={skill.display_name} purpose="Edit catalogue entry, versions and workflow." />
      <SkillEditor skill={skill} versions={versions} minTestCases={minTestCases} />
    </div>
  );
}
