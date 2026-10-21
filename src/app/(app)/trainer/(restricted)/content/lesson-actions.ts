"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { authorise } from "@/lib/auth";
import { databaseMessage, notAllowed, type ActionResult } from "@/lib/actions/result";
import { validateSlug } from "@/lib/content/slug";
import {
  parseLessonMarkdown,
  previewRow,
  type ModuleLookup,
  type DepartmentLookup,
} from "@/lib/lessons/import";
import { videoEmbedUrl } from "@/lib/markdown/video-embed";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/types/database";

const trainersAndAdmins = ["trainer", "admin"] as const;
type LessonKind = Database["public"]["Enums"]["lesson_kind"];

const changeNote = z
  .string()
  .trim()
  .min(5, { error: "Add a change note of at least five characters." })
  .max(500);

const resourceItem = z.strictObject({
  title: z.string().trim().min(1).max(200),
  url: z.string().trim().url(),
});

const lessonDraftInput = z.strictObject({
  id: z.uuid().optional(),
  moduleId: z.uuid(),
  title: z.string().trim().min(1, { error: "Enter a title." }).max(200),
  slug: z.string().trim().min(1),
  summary: z.string().max(300),
  kind: z.enum(["lesson", "recording", "worked_example"]),
  durationMin: z.number().int().min(1).max(60),
  videoUrl: z
    .string()
    .trim()
    .transform((v) => v || null),
  resources: z.array(resourceItem).max(20),
  departmentIds: z.array(z.uuid()),
  sortOrder: z.number().int().min(0).max(9999),
  bodyMd: z.string().max(200_000),
});

function parseSlug(slug: string) {
  const check = validateSlug(slug);
  if (!check.ok) {
    return { ok: false as const, error: check.error };
  }
  return { ok: true as const, value: slug };
}

async function loadLookups(supabase: Awaited<ReturnType<typeof createClient>>) {
  const [{ data: modules }, { data: departments }] = await Promise.all([
    supabase.from("modules").select("id, code"),
    supabase.from("departments").select("id, code"),
  ]);
  const moduleLookup: ModuleLookup = {};
  for (const row of modules ?? []) {
    moduleLookup[row.code.toUpperCase()] = row.id;
  }
  const departmentLookup: DepartmentLookup = {};
  for (const row of departments ?? []) {
    departmentLookup[row.code.toLowerCase()] = row.id;
  }
  return { moduleLookup, departmentLookup };
}

export async function saveLessonDraft(
  input: z.input<typeof lessonDraftInput>,
): Promise<ActionResult<{ id: string }>> {
  if (!(await authorise(trainersAndAdmins))) {
    return { ok: false, error: notAllowed };
  }
  const parsed = lessonDraftInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form." };
  }
  const slugCheck = parseSlug(parsed.data.slug);
  if (!slugCheck.ok) {
    return { ok: false, error: slugCheck.error };
  }
  if (parsed.data.videoUrl && !videoEmbedUrl(parsed.data.videoUrl)) {
    return { ok: false, error: "Video link must be Google Drive or YouTube." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: notAllowed };
  }

  let lessonId = parsed.data.id;
  if (!lessonId) {
    const { data: created, error } = await supabase
      .from("lessons")
      .insert({
        module_id: parsed.data.moduleId,
        slug: slugCheck.value,
        title: parsed.data.title,
        body_md: "",
        status: "draft",
        kind: parsed.data.kind as LessonKind,
        duration_min: parsed.data.durationMin,
        summary: parsed.data.summary || null,
        video_url: parsed.data.videoUrl,
        resources: parsed.data.resources,
        department_ids: parsed.data.departmentIds,
        sort_order: parsed.data.sortOrder,
      })
      .select("id")
      .single();
    if (error) {
      return { ok: false, error: databaseMessage(error, "The lesson was not saved.") };
    }
    lessonId = created.id;
  } else {
    const { data: existing } = await supabase
      .from("lessons")
      .select("status, published_at")
      .eq("id", lessonId)
      .maybeSingle();
    const { error } = await supabase
      .from("lessons")
      .update({
        module_id: parsed.data.moduleId,
        sort_order: parsed.data.sortOrder,
        ...(!existing?.published_at
          ? {
              slug: slugCheck.value,
              title: parsed.data.title,
              kind: parsed.data.kind as LessonKind,
              duration_min: parsed.data.durationMin,
              summary: parsed.data.summary || null,
              video_url: parsed.data.videoUrl,
              resources: parsed.data.resources,
              department_ids: parsed.data.departmentIds,
            }
          : {}),
      })
      .eq("id", lessonId);
    if (error) {
      return { ok: false, error: databaseMessage(error, "The lesson was not saved.") };
    }
  }

  const metadata = {
    module_id: parsed.data.moduleId,
    slug: slugCheck.value,
    summary: parsed.data.summary,
    kind: parsed.data.kind,
    duration_min: parsed.data.durationMin,
    video_url: parsed.data.videoUrl,
    resources: parsed.data.resources,
    department_ids: parsed.data.departmentIds,
    sort_order: parsed.data.sortOrder,
  };

  const { error: draftError } = await supabase.from("content_drafts").upsert(
    {
      content_type: "lesson",
      content_id: lessonId,
      title: parsed.data.title,
      body_md: parsed.data.bodyMd,
      metadata,
      updated_by: user.id,
    },
    { onConflict: "content_type,content_id" },
  );
  if (draftError) {
    return { ok: false, error: databaseMessage(draftError, "The draft was not saved.") };
  }

  revalidatePath("/trainer/content");
  revalidatePath(`/trainer/content/lessons/${lessonId}`);
  revalidatePath("/lessons", "layout");
  return { ok: true, data: { id: lessonId } };
}

export async function publishLesson(input: {
  id: string;
  changeNote: string;
}): Promise<ActionResult<{ version: number }>> {
  if (!(await authorise(trainersAndAdmins))) {
    return { ok: false, error: notAllowed };
  }
  const note = changeNote.safeParse(input.changeNote);
  if (!note.success) {
    return { ok: false, error: note.error.issues[0]?.message ?? "Add a change note." };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("publish_content", {
    p_type: "lesson",
    p_id: input.id,
    p_change_note: note.data,
  });
  if (error) {
    return { ok: false, error: databaseMessage(error, "Publish did not complete.") };
  }
  revalidatePath("/", "layout");
  return { ok: true, data: { version: data as number } };
}

export async function unpublishLesson(input: { id: string; reason: string }): Promise<ActionResult> {
  if (!(await authorise(trainersAndAdmins))) {
    return { ok: false, error: notAllowed };
  }
  const reason = changeNote.safeParse(input.reason);
  if (!reason.success) {
    return { ok: false, error: reason.error.issues[0]?.message ?? "Add a reason." };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("unpublish_content", {
    p_type: "lesson",
    p_id: input.id,
    p_reason: reason.data,
  });
  if (error) {
    return { ok: false, error: databaseMessage(error, "Unpublish did not complete.") };
  }
  revalidatePath("/", "layout");
  return { ok: true, data: null };
}

export async function restoreLessonRevision(input: {
  id: string;
  revisionNo: number;
}): Promise<ActionResult> {
  if (!(await authorise(trainersAndAdmins))) {
    return { ok: false, error: notAllowed };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("restore_revision", {
    p_type: "lesson",
    p_id: input.id,
    p_revision_no: input.revisionNo,
  });
  if (error) {
    return { ok: false, error: databaseMessage(error, "Restore did not complete.") };
  }
  revalidatePath(`/trainer/content/lessons/${input.id}`);
  return { ok: true, data: null };
}

const importFile = z.strictObject({
  fileName: z.string().min(1),
  content: z.string().min(1),
});

export async function previewLessonImports(
  files: z.input<typeof importFile>[],
): Promise<ActionResult<{ rows: ReturnType<typeof previewRow>[] }>> {
  if (!(await authorise(trainersAndAdmins))) {
    return { ok: false, error: notAllowed };
  }
  const supabase = await createClient();
  const { moduleLookup, departmentLookup } = await loadLookups(supabase);
  const rows: ReturnType<typeof previewRow>[] = [];

  for (const raw of files) {
    const parsedFile = importFile.safeParse(raw);
    if (!parsedFile.success) {
      continue;
    }
    try {
      const lesson = parseLessonMarkdown(parsedFile.data.fileName, parsedFile.data.content);
      const moduleId = moduleLookup[lesson.moduleCode.toUpperCase()];
      let existingSlug = false;
      if (moduleId) {
        const { data: existing } = await supabase
          .from("lessons")
          .select("id")
          .eq("module_id", moduleId)
          .eq("slug", lesson.slug)
          .maybeSingle();
        existingSlug = Boolean(existing);
      }
      rows.push(previewRow(lesson, moduleLookup, departmentLookup, existingSlug));
    } catch (error) {
      rows.push({
        fileName: parsedFile.data.fileName,
        moduleCode: "—",
        title: "—",
        kind: "—",
        durationMin: 0,
        departments: "—",
        ready: false,
        result: error instanceof Error ? error.message : "Could not parse file.",
      });
    }
  }
  return { ok: true, data: { rows } };
}

export async function importLessonDrafts(
  files: z.input<typeof importFile>[],
): Promise<ActionResult<{ imported: number }>> {
  if (!(await authorise(trainersAndAdmins))) {
    return { ok: false, error: notAllowed };
  }
  const preview = await previewLessonImports(files);
  if (!preview.ok) {
    return preview;
  }
  const readyNames = new Set(preview.data.rows.filter((r) => r.ready).map((r) => r.fileName));
  const toImport = files.filter((f) => readyNames.has(f.fileName));
  if (toImport.length === 0) {
    return { ok: false, error: "No ready files to import." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: notAllowed };
  }
  const { moduleLookup, departmentLookup } = await loadLookups(supabase);
  let imported = 0;

  for (const raw of toImport) {
    const parsedFile = importFile.parse(raw);
    const lesson = parseLessonMarkdown(parsedFile.fileName, parsedFile.content);
    const errors = preview.data.rows.find((r) => r.fileName === parsedFile.fileName);
    if (!errors?.ready) {
      continue;
    }
    const moduleId = moduleLookup[lesson.moduleCode.toUpperCase()];
    if (!moduleId) {
      continue;
    }

    let departmentIds: string[] = [];
    if (lesson.departmentCodes !== "all") {
      departmentIds = lesson.departmentCodes.map((c) => departmentLookup[c]).filter(Boolean);
    }

    const { data: existing } = await supabase
      .from("lessons")
      .select("id, published_at")
      .eq("module_id", moduleId)
      .eq("slug", lesson.slug)
      .maybeSingle();

    let lessonId = existing?.id;
    if (!lessonId) {
      const { data: created, error } = await supabase
        .from("lessons")
        .insert({
          module_id: moduleId,
          slug: lesson.slug,
          title: lesson.title,
          body_md: "",
          status: "draft",
          kind: lesson.kind,
          duration_min: lesson.durationMin,
          summary: lesson.summary || null,
          video_url: lesson.videoUrl,
          resources: lesson.resources,
          department_ids: departmentIds,
          sort_order: lesson.sortOrder,
        })
        .select("id")
        .single();
      if (error) {
        return { ok: false, error: databaseMessage(error, `Import failed for ${parsedFile.fileName}.`) };
      }
      lessonId = created.id;
    }

    const metadata = {
      module_id: moduleId,
      slug: lesson.slug,
      summary: lesson.summary,
      kind: lesson.kind,
      duration_min: lesson.durationMin,
      video_url: lesson.videoUrl,
      resources: lesson.resources,
      department_ids: departmentIds,
      sort_order: lesson.sortOrder,
    };

    const { error: draftError } = await supabase.from("content_drafts").upsert(
      {
        content_type: "lesson",
        content_id: lessonId,
        title: lesson.title,
        body_md: lesson.bodyMd,
        metadata,
        updated_by: user.id,
      },
      { onConflict: "content_type,content_id" },
    );
    if (draftError) {
      return { ok: false, error: databaseMessage(draftError, `Import failed for ${parsedFile.fileName}.`) };
    }
    imported += 1;
  }

  revalidatePath("/trainer/content");
  revalidatePath("/lessons", "layout");
  return { ok: true, data: { imported } };
}

export async function reorderLessons(input: {
  moduleId: string;
  lessonIds: string[];
}): Promise<ActionResult> {
  if (!(await authorise(trainersAndAdmins))) {
    return { ok: false, error: notAllowed };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("reorder_lessons", {
    p_module_id: input.moduleId,
    p_lesson_ids: input.lessonIds,
  });
  if (error) {
    return { ok: false, error: databaseMessage(error, "Reorder did not complete.") };
  }
  revalidatePath("/trainer/content");
  revalidatePath("/lessons", "layout");
  return { ok: true, data: null };
}

export async function updateModuleOverview(input: {
  moduleId: string;
  bodyMd: string;
  changeNote: string;
}): Promise<ActionResult> {
  if (!(await authorise(trainersAndAdmins))) {
    return { ok: false, error: notAllowed };
  }
  const note = changeNote.safeParse(input.changeNote);
  if (!note.success) {
    return { ok: false, error: note.error.issues[0]?.message ?? "Add a change note." };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_module_overview", {
    p_module_id: input.moduleId,
    p_body_md: input.bodyMd,
    p_change_note: note.data,
  });
  if (error) {
    return { ok: false, error: databaseMessage(error, "Overview was not saved.") };
  }
  revalidatePath("/lessons", "layout");
  return { ok: true, data: null };
}

