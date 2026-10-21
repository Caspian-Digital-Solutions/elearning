import "server-only";

import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/format";
import type { Database } from "@/lib/types/database";

type LessonKind = Database["public"]["Enums"]["lesson_kind"];

export async function loadLessonEditorData(lessonId: string) {
  const supabase = await createClient();
  const { data: lesson } = await supabase.from("lessons").select("*").eq("id", lessonId).maybeSingle();
  if (!lesson) {
    return null;
  }

  const { data: draft } = await supabase
    .from("content_drafts")
    .select("*")
    .eq("content_type", "lesson")
    .eq("content_id", lessonId)
    .maybeSingle();

  const meta = (draft?.metadata ?? {}) as Record<string, unknown>;

  const { data: revisions } = await supabase
    .from("content_revisions")
    .select("revision_no, title, body_md, change_note, published_at, published_by, metadata")
    .eq("content_type", "lesson")
    .eq("content_id", lessonId)
    .order("revision_no", { ascending: false });

  const publisherIds = [...new Set((revisions ?? []).map((r) => r.published_by).filter(Boolean))] as string[];
  const { data: publishers } = publisherIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", publisherIds)
    : { data: [] };
  const publisherMap = new Map((publishers ?? []).map((p) => [p.id, p.full_name ?? "Someone"]));

  const rawResources =
    (meta.resources as { title: string; url: string }[] | undefined) ??
    (lesson.resources as { title: string; url: string }[] | null) ??
    [];
  const resources = Array.isArray(rawResources)
    ? rawResources.filter(
        (item): item is { title: string; url: string } =>
          Boolean(item && typeof item === "object" && "title" in item && "url" in item),
      )
    : [];

  return {
    lessonId,
    initial: {
      moduleId: String(meta.module_id ?? lesson.module_id),
      title: draft?.title ?? lesson.title,
      slug: String(meta.slug ?? lesson.slug),
      bodyMd: draft?.body_md ?? lesson.body_md,
      summary: String(meta.summary ?? lesson.summary ?? ""),
      kind: (meta.kind as LessonKind) ?? lesson.kind,
      durationMin: Number(meta.duration_min ?? lesson.duration_min ?? 10),
      videoUrl: String(meta.video_url ?? lesson.video_url ?? ""),
      resources,
      departmentIds: (meta.department_ids as string[] | undefined) ?? lesson.department_ids ?? [],
      sortOrder: Number(meta.sort_order ?? lesson.sort_order ?? 0),
      version: lesson.version,
      publishedAt: lesson.published_at,
      slugLocked: Boolean(lesson.published_at),
    },
    revisions: (revisions ?? []).map((rev) => ({
      revisionNo: rev.revision_no,
      publishedAt: rev.published_at,
      publisher: rev.published_by ? publisherMap.get(rev.published_by) ?? "Someone" : "Someone",
      changeNote: rev.change_note,
      title: rev.title,
      bodyMd: rev.body_md,
    })),
  };
}

export async function loadModuleTrainerView(moduleCode: string) {
  const supabase = await createClient();
  const { data: module } = await supabase
    .from("modules")
    .select("id, code, title, overview_md, stages ( name )")
    .ilike("code", moduleCode)
    .maybeSingle();
  if (!module) {
    return null;
  }

  const { data: lessons } = await supabase
    .from("lessons")
    .select("id, title, slug, status, sort_order, kind, duration_min")
    .eq("module_id", module.id)
    .order("sort_order");

  const { data: revisions } = await supabase
    .from("content_revisions")
    .select("revision_no, body_md, change_note, published_at, published_by")
    .eq("content_type", "module")
    .eq("content_id", module.id)
    .order("revision_no", { ascending: false });

  const publisherIds = [...new Set((revisions ?? []).map((r) => r.published_by).filter(Boolean))] as string[];
  const { data: publishers } = publisherIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", publisherIds)
    : { data: [] };
  const publisherMap = new Map((publishers ?? []).map((p) => [p.id, p.full_name ?? "Someone"]));

  return {
    module,
    lessons: lessons ?? [],
    revisions: (revisions ?? []).map((rev) => ({
      revisionNo: rev.revision_no,
      publishedAt: rev.published_at,
      publisher: rev.published_by ? publisherMap.get(rev.published_by) ?? "Someone" : "Someone",
      changeNote: rev.change_note,
      bodyMd: rev.body_md,
    })),
  };
}

export { formatDateTime };
