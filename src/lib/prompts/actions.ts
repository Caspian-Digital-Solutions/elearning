"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole, requireUser } from "@/lib/auth";
import { blockSampleContentInProduction } from "@/lib/security/production-content";
import { createClient } from "@/lib/supabase/server";
import { promptLibraryClient } from "@/lib/prompts/db-client";
import {
  parsePromptImportJson,
  validatePromptImport,
  type PromptImportEntry,
} from "@/lib/prompts/import-validator";
import { loadTaskTypes } from "@/lib/prompts/queries";

const feedbackSchema = z.object({
  promptId: z.string().uuid(),
  promptVersion: z.coerce.number().int().positive(),
  outcome: z.enum(["worked", "needed_edits", "did_not_work"]),
  comment: z.string().max(500).optional(),
  declaration: z.literal(true),
});

const copySchema = z.object({
  promptId: z.string().uuid(),
  promptVersion: z.coerce.number().int().positive(),
});

export async function logPromptCopyAction(input: z.infer<typeof copySchema>): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = copySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid copy request." };
  }
  await requireUser();
  const supabase = promptLibraryClient(await createClient());
  const { error } = await supabase.rpc("log_prompt_copy", {
    p_prompt_id: parsed.data.promptId,
    p_prompt_version: parsed.data.promptVersion,
  });
  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export async function givePromptFeedbackAction(
  input: z.infer<typeof feedbackSchema>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = feedbackSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Check your feedback and try again." };
  }
  await requireUser();
  const supabase = promptLibraryClient(await createClient());
  const { error } = await supabase.rpc("give_prompt_feedback", {
    p_prompt_id: parsed.data.promptId,
    p_prompt_version: parsed.data.promptVersion,
    p_outcome: parsed.data.outcome,
    p_comment: parsed.data.comment ?? null,
    p_declaration: parsed.data.declaration,
  });
  if (error) {
    return { ok: false, error: error.message };
  }
  revalidatePath("/trainer/content");
  return { ok: true };
}

export async function importPromptsJson(
  text: string,
  options: { departmentCodes: string[]; moduleCodes: string[] },
): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  await requireRole(["trainer", "admin"]);
  const parsed = parsePromptImportJson(text);
  if (!parsed.ok) {
    return { ok: false, error: parsed.errors.join(" ") };
  }
  const taskTypes = await loadTaskTypes();
  const validated = validatePromptImport(parsed.data, {
    taskTypes,
    departmentCodes: options.departmentCodes,
    moduleCodes: options.moduleCodes,
  });
  if (!validated.ok) {
    return { ok: false, error: validated.errors.join(" ") };
  }

  for (const entry of validated.entries) {
    const sample =
      Boolean(entry.is_sample) || entry.title.trim().toUpperCase().startsWith("SAMPLE");
    const blocked = blockSampleContentInProduction(sample);
    if (blocked) {
      return { ok: false, error: blocked };
    }
  }

  const supabase = promptLibraryClient(await createClient());
  const user = await requireUser();
  for (const entry of validated.entries) {
    const insert = await buildInsertRow(supabase, entry, user.id);
    if (!insert.ok) {
      return insert;
    }
    const { error } = await supabase.from("prompts").insert(insert.row);
    if (error) {
      return { ok: false, error: error.message };
    }
  }
  revalidatePath("/trainer/content");
  revalidatePath("/prompt-library");
  return { ok: true, count: validated.entries.length };
}

async function buildInsertRow(
  supabase: Awaited<ReturnType<typeof createClient>>,
  entry: PromptImportEntry,
  ownerId: string,
): Promise<{ ok: true; row: Record<string, unknown> } | { ok: false; error: string }> {
  let departmentId: string | null = null;
  if (entry.department_code) {
    const { data: dept } = await supabase
      .from("departments")
      .select("id")
      .eq("code", entry.department_code.toLowerCase())
      .maybeSingle();
    if (!dept) {
      return { ok: false, error: `Unknown department ${entry.department_code}.` };
    }
    departmentId = dept.id;
  }
  let moduleId: string | null = null;
  if (entry.module_code) {
    const { data: mod } = await supabase
      .from("modules")
      .select("id")
      .eq("code", entry.module_code.toLowerCase())
      .maybeSingle();
    if (!mod) {
      return { ok: false, error: `Unknown module ${entry.module_code}.` };
    }
    moduleId = mod.id;
  }
  const isSample = Boolean(entry.is_sample) || entry.title.trim().toUpperCase().startsWith("SAMPLE");
  return {
    ok: true,
    row: {
      slug: entry.slug.toLowerCase(),
      title: entry.title.trim(),
      department_id: departmentId,
      task_type: entry.task_type.toLowerCase(),
      tool: entry.tool,
      module_id: moduleId,
      risk_tier: entry.risk_tier,
      body: entry.body,
      usage_notes_md: entry.usage_notes_md?.trim() ?? "",
      example_md: entry.example_md?.trim() ?? "",
      owner_id: ownerId,
      status: "draft",
      is_sample: isSample,
    },
  };
}
