"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { authorise } from "@/lib/auth";
import { databaseMessage, notAllowed, type ActionResult } from "@/lib/actions/result";
import {
  parseAssessmentImportJson,
  validateAssessmentImport,
  type AssessmentImportFile,
  type AssessmentImportItem,
} from "@/lib/assessments/import";
import { buildLearnerAssessmentPayload } from "@/lib/assessments/learner-payload";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/types/database";

const trainersAndAdmins = ["trainer", "admin"] as const;

const importInput = z.strictObject({
  jsonText: z.string().min(2),
});

export type AssessmentImportPreview = {
  ok: boolean;
  errors: string[];
  sections: { code: string; itemPoints: number; maxScore: number | null; ok: boolean }[];
};

export async function previewAssessmentImport(jsonText: string): Promise<ActionResult<AssessmentImportPreview>> {
  if (!(await authorise(trainersAndAdmins))) {
    return { ok: false, error: notAllowed };
  }
  const parsed = parseAssessmentImportJson(jsonText);
  if (!parsed.ok) {
    return { ok: true, data: { ok: false, errors: parsed.errors, sections: [] } };
  }
  const supabase = await createClient();
  const { data: setting } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "placement.week0_sections")
    .maybeSingle();
  const validation = validateAssessmentImport(parsed.data, { week0Sections: setting?.value });
  return {
    ok: true,
    data: {
      ok: validation.ok,
      errors: validation.errors,
      sections: validation.sections.map((s) => ({
        code: s.code,
        itemPoints: s.itemPoints,
        maxScore: s.maxScore,
        ok: s.ok,
      })),
    },
  };
}

async function loadLookups(supabase: Awaited<ReturnType<typeof createClient>>) {
  const [{ data: domains }, { data: departments }, { data: modules }] = await Promise.all([
    supabase.from("competency_domains").select("id, code"),
    supabase.from("departments").select("id, code"),
    supabase.from("modules").select("id, code"),
  ]);
  const domainByCode = new Map((domains ?? []).map((d) => [d.code.toUpperCase(), d.id]));
  const departmentByCode = new Map((departments ?? []).map((d) => [d.code.toLowerCase(), d.id]));
  return { domainByCode, departmentByCode, moduleCodes: (modules ?? []).map((m) => m.code) };
}

async function ensureRubric(
  supabase: Awaited<ReturnType<typeof createClient>>,
  rubric: AssessmentImportFile["rubrics"][number],
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

function learnerOptions(item: AssessmentImportItem) {
  return (item.options ?? []).map((opt) => ({ id: opt.id, text: opt.text }));
}

function optionPoints(item: AssessmentImportItem): Record<string, number> {
  const points: Record<string, number> = {};
  for (const opt of item.options ?? []) {
    points[opt.id] = opt.points;
  }
  return points;
}

export async function importAssessmentDraft(
  input: z.input<typeof importInput>,
): Promise<ActionResult<{ id: string }>> {
  if (!(await authorise(trainersAndAdmins))) {
    return { ok: false, error: notAllowed };
  }
  const parsed = importInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "The import file is not valid." };
  }
  const fileParse = parseAssessmentImportJson(parsed.data.jsonText);
  if (!fileParse.ok) {
    return { ok: false, error: fileParse.errors.join(" ") };
  }
  const supabase = await createClient();
  const { data: setting } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "placement.week0_sections")
    .maybeSingle();
  const validation = validateAssessmentImport(fileParse.data, { week0Sections: setting?.value });
  if (!validation.ok) {
    return { ok: false, error: validation.errors.join(" ") };
  }

  const file = fileParse.data;
  const { domainByCode, departmentByCode } = await loadLookups(supabase);

  const { data: versions } = await supabase
    .from("assessments")
    .select("version")
    .eq("code", file.assessment.code)
    .order("version", { ascending: false })
    .limit(1);
  const nextVersion = (versions?.[0]?.version ?? 0) + 1;

  const { data: assessment, error: asmError } = await supabase
    .from("assessments")
    .insert({
      code: file.assessment.code,
      title: file.assessment.title,
      type: file.assessment.type,
      instructions_md: file.assessment.instructions_md,
      time_guide_min: file.assessment.time_guide_min,
      is_sample: file.assessment.is_sample,
      version: nextVersion,
      status: "draft",
      module_id: null,
    })
    .select("id")
    .single();
  if (asmError || !assessment) {
    return { ok: false, error: databaseMessage(asmError, "The assessment draft could not be created.") };
  }

  const rubricIds = new Map<string, string>();
  for (const rubric of file.rubrics) {
    rubricIds.set(rubric.ref, await ensureRubric(supabase, rubric));
  }

  const sectionIdByCode = new Map<string, string>();
  for (const [index, section] of file.sections.entries()) {
    const { data: row, error } = await supabase
      .from("assessment_sections")
      .insert({
        assessment_id: assessment.id,
        code: section.code,
        title: section.title,
        max_score: section.max_score,
        counts_in_total: section.counts_in_total,
        instructions_md: section.instructions_md ?? "",
        sort_order: index,
      })
      .select("id")
      .single();
    if (error || !row) {
      return { ok: false, error: databaseMessage(error, "A section could not be saved.") };
    }
    sectionIdByCode.set(section.code, row.id);
  }

  for (const [index, item] of file.items.entries()) {
    const sectionId = sectionIdByCode.get(item.section);
    if (!sectionId) {
      continue;
    }
    const domainId = domainByCode.get(item.domain.toUpperCase()) ?? null;
    const departmentId = item.department
      ? departmentByCode.get(item.department.toLowerCase()) ?? null
      : null;
    const { data: itemRow, error: itemError } = await supabase
      .from("assessment_items")
      .insert({
        assessment_id: assessment.id,
        section_id: sectionId,
        ref: item.ref,
        type: item.type,
        sort_order: item.sort_order ?? index,
        prompt_md: item.prompt_md,
        options: learnerOptions(item) as NonNullable<Json>,
        response_format: item.response_format ?? null,
        department_id: departmentId,
        domain_id: domainId,
        difficulty: item.difficulty ?? null,
        points: item.points,
        rubric_id: item.rubric ? rubricIds.get(item.rubric) ?? null : null,
      })
      .select("id")
      .single();
    if (itemError || !itemRow) {
      return { ok: false, error: databaseMessage(itemError, "An item could not be saved.") };
    }
    await supabase.from("assessment_item_keys").insert({
      item_id: itemRow.id,
      option_points: optionPoints(item) as NonNullable<Json>,
      model_answer_md: item.model_answer_md ?? null,
      explanation_md: item.explanation_md ?? null,
      marking_notes_md: item.marking_notes_md ?? null,
    });
  }

  revalidatePath("/trainer/content");
  return { ok: true, data: { id: assessment.id } };
}

export async function publishAssessment(input: {
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
  const user = (await supabase.auth.getUser()).data.user;
  const { error } = await supabase
    .from("assessments")
    .update({
      status: "published",
      published_at: new Date().toISOString(),
      published_by: user?.id ?? null,
    })
    .eq("id", input.id)
    .eq("status", "draft");
  if (error) {
    return { ok: false, error: databaseMessage(error, "Publish did not complete.") };
  }
  revalidatePath("/trainer/content");
  revalidatePath("/assessments");
  return { ok: true, data: null };
}

export async function loadAssessmentPreview(assessmentId: string, showKeys: boolean) {
  if (!(await authorise(trainersAndAdmins))) {
    return null;
  }
  const supabase = await createClient();
  const { data: assessment } = await supabase
    .from("assessments")
    .select("id, code, title, type, instructions_md, time_guide_min, is_sample, version")
    .eq("id", assessmentId)
    .maybeSingle();
  if (!assessment) {
    return null;
  }
  const [{ data: sections }, { data: items }] = await Promise.all([
    supabase.from("assessment_sections").select("*").eq("assessment_id", assessmentId).order("sort_order"),
    supabase.from("assessment_items").select("*").eq("assessment_id", assessmentId).order("sort_order"),
  ]);
  const payload = buildLearnerAssessmentPayload(
    assessment,
    sections ?? [],
    (items ?? []).map((item) => ({
      id: item.id,
      ref: item.ref,
      type: item.type,
      sort_order: item.sort_order,
      prompt_md: item.prompt_md,
      options: item.options,
      response_format: item.response_format,
      department_id: item.department_id,
      section_id: item.section_id,
    })),
  );
  let keys: Record<string, unknown> = {};
  if (showKeys && items?.length) {
    const { data: keyRows } = await supabase
      .from("assessment_item_keys")
      .select("item_id, option_points, model_answer_md, explanation_md, marking_notes_md")
      .in("item_id", items.map((i) => i.id));
    keys = Object.fromEntries((keyRows ?? []).map((k) => [k.item_id, k]));
  }
  return { payload, keys };
}
