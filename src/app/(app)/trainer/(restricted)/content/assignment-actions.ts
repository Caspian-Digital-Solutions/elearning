"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { authorise } from "@/lib/auth";
import { databaseMessage, notAllowed, type ActionResult } from "@/lib/actions/result";
import type { AssessmentImportRubric } from "@/lib/assessments/import";
import {
  parseAssignmentImportJson,
  validateAssignmentImport,
  type AssignmentImportFile,
} from "@/lib/assignments/import";
import { createAssignmentsClient } from "@/lib/supabase/assignments-client";
import { createClient } from "@/lib/supabase/server";
import type { Database, Json } from "@/lib/types/database";

type NonNullableJson = Exclude<Json, null>;

const trainersAndAdmins = ["trainer", "admin"] as const;

const importInput = z.strictObject({
  jsonText: z.string().min(2),
});

const draftInput = z.strictObject({
  id: z.uuid().optional(),
  code: z.string().trim().min(1),
  title: z.string().trim().min(1).max(200),
  moduleId: z.uuid(),
  rubricId: z.uuid(),
  bodyMd: z.string().max(200_000),
  submissionTypes: z.array(z.enum(["link", "file", "text"])).min(1),
  departmentId: z.uuid().nullable(),
  passMarkPct: z.number().int().min(0).max(100),
  isTestOut: z.boolean(),
  isSample: z.boolean(),
});

async function ensureRubric(
  supabase: Awaited<ReturnType<typeof createClient>>,
  rubric: AssessmentImportRubric,
): Promise<string> {
  const { data: existing } = await supabase.from("rubrics").select("id").eq("ref", rubric.ref).maybeSingle();
  if (existing) {
    return existing.id;
  }
  const { data: inserted, error } = await supabase
    .from("rubrics")
    .insert({ ref: rubric.ref, title: rubric.title })
    .select("id")
    .single();
  if (error || !inserted) {
    throw new Error("Rubric could not be saved.");
  }
  for (const [index, criterion] of rubric.criteria.entries()) {
    const { data: crit, error: critError } = await supabase
      .from("rubric_criteria")
      .insert({
        rubric_id: inserted.id,
        name: criterion.name,
        max_score: criterion.max_score,
        sort_order: index,
      })
      .select("id")
      .single();
    if (critError || !crit) {
      throw new Error("Rubric criterion could not be saved.");
    }
    for (const level of criterion.levels) {
      await supabase.from("rubric_levels").insert({
        criterion_id: crit.id,
        score: level.score,
        descriptor: level.descriptor,
      });
    }
  }
  return inserted.id;
}

export async function previewAssignmentImport(jsonText: string): Promise<ActionResult<{ errors: string[] }>> {
  if (!(await authorise(trainersAndAdmins))) {
    return { ok: false, error: notAllowed };
  }
  const parsed = parseAssignmentImportJson(jsonText);
  if (!parsed.ok) {
    return { ok: true, data: { errors: parsed.errors } };
  }
  const supabase = await createClient();
  const { data: modules } = await supabase.from("modules").select("code");
  const validation = validateAssignmentImport(parsed.data, {
    moduleCodes: (modules ?? []).map((m) => m.code),
  });
  return { ok: true, data: { errors: validation.ok ? [] : validation.errors } };
}

export async function importAssignmentDraft(
  input: z.input<typeof importInput>,
): Promise<ActionResult<{ id: string }>> {
  if (!(await authorise(trainersAndAdmins))) {
    return { ok: false, error: notAllowed };
  }
  const parsed = importInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "The import file is not valid." };
  }
  const fileParse = parseAssignmentImportJson(parsed.data.jsonText);
  if (!fileParse.ok) {
    return { ok: false, error: fileParse.errors.join(" ") };
  }
  const supabase = await createClient();
  const assignmentsClient = await createAssignmentsClient();
  const { data: modules } = await supabase.from("modules").select("id, code");
  const { data: departments } = await supabase.from("departments").select("id, code");
  const moduleByCode = new Map((modules ?? []).map((m) => [m.code.toLowerCase(), m.id]));
  const deptByCode = new Map((departments ?? []).map((d) => [d.code.toLowerCase(), d.id]));
  const validation = validateAssignmentImport(fileParse.data, {
    moduleCodes: (modules ?? []).map((m) => m.code),
  });
  if (!validation.ok) {
    return { ok: false, error: validation.errors.join(" ") };
  }

  const file = fileParse.data;
  const entry = file.assignments[0];
  const rubricId = await ensureRubric(supabase, file.rubrics.find((r) => r.ref === entry.rubric_ref)!);
  const moduleId = moduleByCode.get(entry.module_code.toLowerCase());
  if (!moduleId) {
    return { ok: false, error: "Module not found." };
  }
  const departmentId = entry.department_code
    ? deptByCode.get(entry.department_code.toLowerCase()) ?? null
    : null;

  const { data: versions } = await assignmentsClient
    .from("assignments")
    .select("version")
    .eq("code", entry.code)
    .order("version", { ascending: false })
    .limit(1);
  const nextVersion = (versions?.[0]?.version ?? 0) + 1;

  const { data: row, error } = await assignmentsClient
    .from("assignments")
    .insert({
      code: entry.code,
      module_id: moduleId,
      title: entry.title,
      brief_md: entry.brief_md,
      rubric_id: rubricId,
      submission_types: entry.submission_types,
      department_id: departmentId,
      pass_mark_pct: entry.pass_mark_pct,
      is_test_out: entry.is_test_out,
      is_sample: entry.is_sample,
      version: nextVersion,
      status: "draft",
    })
    .select("id")
    .single();
  if (error || !row) {
    return { ok: false, error: databaseMessage(error, "Draft could not be created.") };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  await supabase.from("content_drafts").upsert(
    {
      content_type: "assignment",
      content_id: row.id,
      title: entry.title,
      body_md: entry.brief_md,
      metadata: {
        module_id: moduleId,
        rubric_id: rubricId,
        submission_types: entry.submission_types,
        department_id: departmentId,
        pass_mark_pct: entry.pass_mark_pct,
        is_test_out: entry.is_test_out,
        is_sample: entry.is_sample,
      } as NonNullableJson,
      updated_by: user?.id ?? null,
    },
    { onConflict: "content_type,content_id" },
  );

  revalidatePath("/trainer/content");
  return { ok: true, data: { id: row.id } };
}

export async function saveAssignmentDraft(
  input: z.input<typeof draftInput>,
): Promise<ActionResult<{ id: string }>> {
  if (!(await authorise(trainersAndAdmins))) {
    return { ok: false, error: notAllowed };
  }
  const parsed = draftInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form." };
  }
  const assignmentsClient = await createAssignmentsClient();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let assignmentId = parsed.data.id;
  if (!assignmentId) {
    const { data: versions } = await assignmentsClient
      .from("assignments")
      .select("version")
      .eq("code", parsed.data.code)
      .order("version", { ascending: false })
      .limit(1);
    const nextVersion = (versions?.[0]?.version ?? 0) + 1;
    const { data: inserted, error } = await assignmentsClient
      .from("assignments")
      .insert({
        code: parsed.data.code,
        module_id: parsed.data.moduleId,
        title: parsed.data.title,
        brief_md: parsed.data.bodyMd,
        rubric_id: parsed.data.rubricId,
        submission_types: parsed.data.submissionTypes,
        department_id: parsed.data.departmentId,
        pass_mark_pct: parsed.data.passMarkPct,
        is_test_out: parsed.data.isTestOut,
        is_sample: parsed.data.isSample,
        version: nextVersion,
        status: "draft",
      })
      .select("id")
      .single();
    if (error || !inserted) {
      return { ok: false, error: databaseMessage(error, "Draft could not be created.") };
    }
    assignmentId = inserted.id;
  } else {
    const { error } = await assignmentsClient
      .from("assignments")
      .update({
        title: parsed.data.title,
        brief_md: parsed.data.bodyMd,
        module_id: parsed.data.moduleId,
        rubric_id: parsed.data.rubricId,
        submission_types: parsed.data.submissionTypes,
        department_id: parsed.data.departmentId,
        pass_mark_pct: parsed.data.passMarkPct,
        is_test_out: parsed.data.isTestOut,
        is_sample: parsed.data.isSample,
      })
      .eq("id", assignmentId);
    if (error) {
      return { ok: false, error: databaseMessage(error, "Draft could not be saved.") };
    }
  }

  await supabase.from("content_drafts").upsert(
    {
      content_type: "assignment",
      content_id: assignmentId,
      title: parsed.data.title,
      body_md: parsed.data.bodyMd,
      metadata: {
        module_id: parsed.data.moduleId,
        rubric_id: parsed.data.rubricId,
        submission_types: parsed.data.submissionTypes,
        department_id: parsed.data.departmentId,
        pass_mark_pct: parsed.data.passMarkPct,
        is_test_out: parsed.data.isTestOut,
        is_sample: parsed.data.isSample,
      } as NonNullableJson,
      updated_by: user?.id ?? null,
    },
    { onConflict: "content_type,content_id" },
  );

  revalidatePath("/trainer/content");
  revalidatePath(`/trainer/content/assignments/${assignmentId}`);
  return { ok: true, data: { id: assignmentId } };
}

export async function publishAssignment(input: {
  id: string;
  changeNote: string;
}): Promise<ActionResult> {
  if (!(await authorise(trainersAndAdmins))) {
    return { ok: false, error: notAllowed };
  }
  if (input.changeNote.trim().length < 5) {
    return { ok: false, error: "Add a change note of at least five characters." };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("publish_content", {
    p_type: "assignment" as Database["public"]["Enums"]["content_type"],
    p_id: input.id,
    p_change_note: input.changeNote,
  });
  if (error) {
    return { ok: false, error: databaseMessage(error, "Publish did not complete.") };
  }
  revalidatePath("/trainer/content");
  revalidatePath("/assignments");
  return { ok: true, data: null };
}

export async function loadAssignmentEditor(assignmentId: string) {
  if (!(await authorise(trainersAndAdmins))) {
    return null;
  }
  const assignmentsClient = await createAssignmentsClient();
  const supabase = await createClient();
  const { data: row } = await assignmentsClient
    .from("assignments")
    .select("*")
    .eq("id", assignmentId)
    .maybeSingle();
  if (!row) {
    return null;
  }
  const { data: draft } = await supabase
    .from("content_drafts")
    .select("title, body_md, metadata")
    .eq("content_type", "assignment")
    .eq("content_id", assignmentId)
    .maybeSingle();
  const meta = (draft?.metadata ?? {}) as Record<string, unknown>;
  return {
    id: row.id,
    code: row.code,
    title: draft?.title ?? row.title,
    bodyMd: draft?.body_md ?? row.brief_md,
    moduleId: (meta.module_id as string) ?? row.module_id,
    rubricId: (meta.rubric_id as string) ?? row.rubric_id,
    submissionTypes: (meta.submission_types as string[]) ?? row.submission_types,
    departmentId: (meta.department_id as string | null) ?? row.department_id,
    passMarkPct: (meta.pass_mark_pct as number) ?? row.pass_mark_pct,
    isTestOut: Boolean(meta.is_test_out ?? row.is_test_out),
    isSample: Boolean(meta.is_sample ?? row.is_sample),
    status: row.status,
    version: row.version,
  };
}
