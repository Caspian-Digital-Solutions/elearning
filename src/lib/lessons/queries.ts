import "server-only";

import { createClient } from "@/lib/supabase/server";
import { formatDate, formatDateTime } from "@/lib/format";
import type { Database } from "@/lib/types/database";

type LessonKind = Database["public"]["Enums"]["lesson_kind"];

const kindLabels: Record<LessonKind, string> = {
  lesson: "Lesson",
  recording: "Recording",
  worked_example: "Worked example",
};

function lessonStatusLabel(status: string, hasDraft: boolean): string {
  if (status === "archived") {
    return "Archived";
  }
  if (status === "draft") {
    return "Draft";
  }
  if (hasDraft) {
    return "Published with unsaved changes";
  }
  return "Published";
}

export type LessonListRow = {
  id: string;
  moduleCode: string;
  moduleTitle: string;
  stage: string;
  title: string;
  kindLabel: string;
  statusLabel: string;
  version: string;
  departments: string;
  duration: string;
  completions: string;
  lastPublished: string;
};

export async function loadTrainerLessons(): Promise<LessonListRow[]> {
  const supabase = await createClient();
  const [{ data: lessons }, { data: drafts }, { data: departments }] = await Promise.all([
    supabase
      .from("lessons")
      .select(
        "id, title, slug, version, status, duration_min, kind, department_ids, published_at, published_by, module_id, modules ( code, title, stages ( name, sort_order ) )",
      )
      .order("sort_order"),
    supabase.from("content_drafts").select("content_id, title").eq("content_type", "lesson"),
    supabase.from("departments").select("id, name"),
  ]);

  if (!lessons) {
    return [];
  }

  const draftMap = new Map((drafts ?? []).map((d) => [d.content_id, d.title]));
  const draftIds = new Set((drafts ?? []).map((d) => d.content_id));
  const deptName = new Map((departments ?? []).map((d) => [d.id, d.name]));

  const publisherIds = [...new Set((lessons ?? []).map((l) => l.published_by).filter(Boolean))] as string[];
  const { data: publishers } = publisherIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", publisherIds)
    : { data: [] };
  const publisherMap = new Map((publishers ?? []).map((p) => [p.id, p.full_name ?? "Someone"]));

  const completionCounts = new Map<string, number>();
  const { data: progressRows } = await supabase.from("lesson_progress").select("lesson_id");
  for (const row of progressRows ?? []) {
    completionCounts.set(row.lesson_id, (completionCounts.get(row.lesson_id) ?? 0) + 1);
  }

  return lessons.map((lesson) => {
    const moduleRow = lesson.modules as {
      code: string;
      title: string;
      stages: { name: string } | null;
    } | null;
    const deptIds = lesson.department_ids ?? [];
    const departmentsLabel =
      deptIds.length === 0
        ? "All"
        : deptIds.map((id) => deptName.get(id) ?? "—").join(", ");

    const title = draftMap.get(lesson.id) ?? lesson.title;
    const publisher = lesson.published_by ? publisherMap.get(lesson.published_by) : undefined;

    return {
      id: lesson.id,
      moduleCode: moduleRow?.code ?? "—",
      moduleTitle: moduleRow?.title ?? "—",
      stage: moduleRow?.stages?.name ?? "—",
      title,
      kindLabel: kindLabels[lesson.kind as LessonKind] ?? lesson.kind,
      statusLabel: lessonStatusLabel(lesson.status, draftIds.has(lesson.id)),
      version: String(lesson.version),
      departments: departmentsLabel,
      duration: lesson.duration_min ? `${lesson.duration_min} min` : "—",
      completions: String(completionCounts.get(lesson.id) ?? 0),
      lastPublished:
        lesson.published_at ? `${formatDate(lesson.published_at)} · ${publisher ?? "Someone"}` : "—",
    };
  });
}

export type ModuleOption = {
  id: string;
  code: string;
  title: string;
  stageName: string;
  stageSort: number;
};

export async function loadModuleOptions(): Promise<ModuleOption[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("modules")
    .select("id, code, title, stages ( name, sort_order )")
    .order("sort_order");
  return (data ?? []).map((row) => {
    const stage = row.stages as { name: string; sort_order: number } | null;
    return {
      id: row.id,
      code: row.code,
      title: row.title,
      stageName: stage?.name ?? "—",
      stageSort: stage?.sort_order ?? 0,
    };
  });
}

export async function loadActiveDepartments() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("departments")
    .select("id, code, name, parent_id, is_active")
    .eq("is_active", true)
    .order("name");
  return data ?? [];
}

export type LearnerModuleCard = {
  code: string;
  title: string;
  stageName: string;
  stageSort: number;
  isLeadership: boolean;
  weekLabel: string;
  liveHours: string;
  assessedBy: string;
  publishedCount: number;
  completedCount: number;
  departmentLabels: string[];
  hiddenByDefault: boolean;
};

export async function loadLearnerModulesOverview(userId: string) {
  const supabase = await createClient();
  const [{ data: modules }, { data: lessons }, { data: progress }, { data: departments }] =
    await Promise.all([
      supabase
        .from("modules")
        .select(
          "id, code, title, week_start, week_end, live_hours, assessed_by, is_leadership, sort_order, stages ( name, sort_order, code )",
        )
        .order("sort_order"),
      supabase
        .from("lessons")
        .select("id, module_id, department_ids, status")
        .eq("status", "published"),
      supabase.from("lesson_progress").select("lesson_id").eq("user_id", userId),
      supabase.from("departments").select("id, name"),
    ]);

  const deptName = new Map((departments ?? []).map((d) => [d.id, d.name]));
  const completed = new Set((progress ?? []).map((p) => p.lesson_id));
  const lessonsByModule = new Map<string, { id: string; department_ids: string[] }[]>();
  for (const lesson of lessons ?? []) {
    const list = lessonsByModule.get(lesson.module_id) ?? [];
    list.push({ id: lesson.id, department_ids: lesson.department_ids ?? [] });
    lessonsByModule.set(lesson.module_id, list);
  }

  const cards: LearnerModuleCard[] = (modules ?? [])
    .filter((m) => {
      const stage = m.stages as { code: string } | null;
      return stage?.code !== "assessment";
    })
    .map((moduleRow) => {
      const published = lessonsByModule.get(moduleRow.id) ?? [];
      const completedCount = published.filter((l) => completed.has(l.id)).length;
      const deptLabels = new Set<string>();
      for (const lesson of published) {
        if (lesson.department_ids.length === 0) {
          continue;
        }
        for (const id of lesson.department_ids) {
          const name = deptName.get(id);
          if (name) {
            deptLabels.add(name);
          }
        }
      }
      const stage = moduleRow.stages as { name: string; sort_order: number } | null;
      const weeks =
        moduleRow.week_start === moduleRow.week_end
          ? `Week ${moduleRow.week_start}`
          : `Weeks ${moduleRow.week_start}–${moduleRow.week_end}`;

      return {
        code: moduleRow.code,
        title: moduleRow.title,
        stageName: stage?.name ?? "—",
        stageSort: stage?.sort_order ?? 0,
        isLeadership: moduleRow.is_leadership,
        weekLabel: weeks,
        liveHours: `${moduleRow.live_hours}h live`,
        assessedBy: moduleRow.assessed_by ?? "—",
        publishedCount: published.length,
        completedCount,
        departmentLabels: [...deptLabels],
        hiddenByDefault: false,
      };
    });

  return cards;
}

export async function loadLearnerModuleByCode(code: string) {
  const supabase = await createClient();
  const { data: moduleRow } = await supabase
    .from("modules")
    .select(
      "id, code, title, week_start, week_end, live_hours, assessed_by, overview_md, is_leadership, stages ( name ), module_domains ( competency_domains ( name ) )",
    )
    .ilike("code", code)
    .maybeSingle();
  if (!moduleRow) {
    return null;
  }

  const { data: lessons } = await supabase
    .from("lessons")
    .select("id, slug, title, kind, duration_min, sort_order, department_ids")
    .eq("module_id", moduleRow.id)
    .eq("status", "published")
    .order("sort_order");

  const domainNames = (
    (moduleRow.module_domains as { competency_domains: { name: string } | null }[] | null) ?? []
  )
    .map((row) => row.competency_domains?.name)
    .filter(Boolean) as string[];

  return {
    module: moduleRow,
    lessons: lessons ?? [],
    domainNames,
  };
}

export async function loadLearnerLesson(moduleCode: string, lessonSlug: string, userId: string) {
  const supabase = await createClient();
  const { data: moduleRow } = await supabase
    .from("modules")
    .select("id, code, title")
    .ilike("code", moduleCode)
    .maybeSingle();
  if (!moduleRow) {
    return null;
  }

  const { data: lesson } = await supabase
    .from("lessons")
    .select("*")
    .eq("module_id", moduleRow.id)
    .eq("slug", lessonSlug)
    .eq("status", "published")
    .maybeSingle();
  if (!lesson) {
    return null;
  }

  const { data: siblings } = await supabase
    .from("lessons")
    .select("id, slug, title, sort_order")
    .eq("module_id", moduleRow.id)
    .eq("status", "published")
    .order("sort_order");

  const list = siblings ?? [];
  const index = list.findIndex((row) => row.id === lesson.id);
  const prev = index > 0 ? list[index - 1] : null;
  const next = index >= 0 && index < list.length - 1 ? list[index + 1] : null;

  const { data: progress } = await supabase
    .from("lesson_progress")
    .select("completed_at, lesson_version")
    .eq("user_id", userId)
    .eq("lesson_id", lesson.id)
    .maybeSingle();

  return {
    module: moduleRow,
    lesson,
    prev,
    next,
    progress,
  };
}

export function formatKindLabel(kind: LessonKind): string {
  return kindLabels[kind] ?? kind;
}

export { formatDateTime };
