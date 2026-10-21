import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { loadLearnerModulesOverview } from "@/lib/lessons/queries";
import {
  defaultVisibleDepartmentIds,
  leadershipVisibleByDefault,
  moduleVisibleInDefaultView,
  type DepartmentNode,
} from "@/lib/lessons/visibility";
import { LessonsHome } from "@/app/(app)/lessons/lessons-home";

export const metadata: Metadata = {
  title: "Lessons",
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ all?: string }>;
}) {
  const user = await requireUser();
  const { all } = await searchParams;
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, departments ( id, code, parent_id )")
    .eq("id", user.id)
    .maybeSingle();

  const { data: departmentRows } = await supabase
    .from("departments")
    .select("id, code, name, parent_id");

  const departments: DepartmentNode[] = (departmentRows ?? []).map((row) => ({
    id: row.id,
    code: row.code,
    name: row.name,
    parentId: row.parent_id,
  }));

  const dept = profile?.departments as { id: string; code: string; parent_id: string | null } | null;
  const visibleDeptIds = defaultVisibleDepartmentIds(dept?.id ?? null, departments);
  const leadershipDefault = leadershipVisibleByDefault(user.role, dept?.code ?? null);

  const cards = await loadLearnerModulesOverview(user.id);

  const { data: publishedLessons } = await supabase
    .from("lessons")
    .select("module_id, department_ids")
    .eq("status", "published");

  const lessonsByModule = new Map<string, { department_ids: string[] }[]>();
  for (const lesson of publishedLessons ?? []) {
    const list = lessonsByModule.get(lesson.module_id) ?? [];
    list.push({ department_ids: lesson.department_ids ?? [] });
    lessonsByModule.set(lesson.module_id, list);
  }

  const moduleIdByCode = new Map<string, string>();
  const { data: modules } = await supabase.from("modules").select("id, code, is_leadership");
  for (const mod of modules ?? []) {
    moduleIdByCode.set(mod.code, mod.id);
  }

  const enriched = cards.map((card) => {
    const moduleId = moduleIdByCode.get(card.code);
    const moduleLessons = moduleId ? lessonsByModule.get(moduleId) ?? [] : [];
    const visible = moduleVisibleInDefaultView(moduleLessons, visibleDeptIds);
    const hiddenLeadership = card.isLeadership && !leadershipDefault;
    return {
      ...card,
      hiddenByDefault: hiddenLeadership || !visible,
    };
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Lessons"
        purpose="Micro-lessons, recordings and worked examples for each programme module."
      />
      <LessonsHome cards={enriched} showAllDefault={all === "1"} />
    </div>
  );
}
