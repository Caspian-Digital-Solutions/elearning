import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { sections } from "@/config/navigation";
import { requireUser } from "@/lib/auth";
import { loadLearnerSkills } from "@/lib/skills/queries";
import { createClient } from "@/lib/supabase/server";
import { SkillsCatalogueScreen } from "./skills-catalogue-screen";

export const metadata: Metadata = {
  title: "Skills catalogue",
};

export default async function Page() {
  await requireUser();
  const supabase = await createClient();
  const { data: departments } = await supabase.from("departments").select("id, name").eq("is_active", true).order("name");
  const skills = await loadLearnerSkills({ status: "live" });

  return (
    <>
      <PageHeader title={sections.skills.title} purpose={sections.skills.purpose} />
      <SkillsCatalogueScreen
        skills={skills}
        departments={(departments ?? []).map((d) => ({ id: d.id, name: d.name }))}
        defaultStatus="live"
      />
    </>
  );
}
