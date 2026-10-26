"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole, requireUser } from "@/lib/auth";
import { blockSampleContentInProduction } from "@/lib/security/production-content";
import { createClient } from "@/lib/supabase/server";
import { promptLibraryClient } from "@/lib/prompts/db-client";

const draftSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().min(3).max(200),
  slug: z.string().min(3).max(80),
  body: z.string().min(10).max(12000),
  taskType: z.string().min(1),
  tool: z.enum(["claude", "perplexity", "chatgpt"]),
  riskTier: z.enum(["low", "medium", "high"]),
  departmentId: z.string().uuid().nullable(),
  moduleId: z.string().uuid().nullable(),
  usageNotesMd: z.string().max(8000).optional(),
  exampleMd: z.string().max(8000).optional(),
});

export async function savePromptDraft(
  input: z.infer<typeof draftSchema>,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const user = await requireUser();
  const parsed = draftSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Check the form and try again." };
  }
  const sample = parsed.data.title.trim().toUpperCase().startsWith("SAMPLE");
  const blocked = blockSampleContentInProduction(sample);
  if (blocked) {
    return { ok: false, error: blocked };
  }

  const supabase = promptLibraryClient(await createClient());
  const isTrainer = user.actualRole === "trainer" || user.actualRole === "admin";
  if (!isTrainer && user.role !== "champion") {
    return { ok: false, error: "You cannot edit prompts." };
  }

  const row = {
    title: parsed.data.title.trim(),
    slug: parsed.data.slug.trim().toLowerCase(),
    body: parsed.data.body,
    task_type: parsed.data.taskType.toLowerCase(),
    tool: parsed.data.tool,
    risk_tier: parsed.data.riskTier,
    department_id: parsed.data.departmentId,
    module_id: parsed.data.moduleId,
    usage_notes_md: parsed.data.usageNotesMd?.trim() ?? "",
    example_md: parsed.data.exampleMd?.trim() ?? "",
    is_sample: sample,
  };

  if (parsed.data.id) {
    const { error } = await supabase.from("prompts").update(row).eq("id", parsed.data.id);
    if (error) {
      return { ok: false, error: error.message };
    }
    revalidatePath("/trainer/content");
    return { ok: true, id: parsed.data.id };
  }

  const { data, error } = await supabase
    .from("prompts")
    .insert({ ...row, owner_id: user.id, status: "draft" })
    .select("id")
    .single();
  if (error) {
    return { ok: false, error: error.message };
  }
  revalidatePath("/trainer/content");
  return { ok: true, id: data.id };
}

export async function submitPromptForReview(
  promptId: string,
  notes: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireUser();
  const supabase = promptLibraryClient(await createClient());
  const { error } = await supabase.rpc("submit_prompt_for_review", {
    p_prompt_id: promptId,
    p_notes: notes,
  });
  if (error) {
    return { ok: false, error: error.message };
  }
  revalidatePath("/trainer/content");
  return { ok: true };
}

export async function markPromptTested(
  promptId: string,
  testNotes: string,
  tasksTried: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireRole(["trainer", "admin"]);
  const supabase = promptLibraryClient(await createClient());
  const { error } = await supabase.rpc("mark_prompt_tested", {
    p_prompt_id: promptId,
    p_test_notes: testNotes,
    p_tasks_tried: tasksTried,
  });
  if (error) {
    return { ok: false, error: error.message };
  }
  revalidatePath("/trainer/content");
  revalidatePath("/prompt-library");
  return { ok: true };
}

export async function returnPromptWithComments(
  promptId: string,
  comments: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireRole(["trainer", "admin"]);
  const supabase = promptLibraryClient(await createClient());
  const { error } = await supabase.rpc("return_prompt_with_comments", {
    p_prompt_id: promptId,
    p_comments: comments,
  });
  if (error) {
    return { ok: false, error: error.message };
  }
  revalidatePath("/trainer/content");
  return { ok: true };
}

export async function retirePrompt(
  promptId: string,
  reason: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireRole(["trainer", "admin"]);
  const supabase = promptLibraryClient(await createClient());
  const { error } = await supabase.rpc("retire_prompt", {
    p_prompt_id: promptId,
    p_reason: reason,
  });
  if (error) {
    return { ok: false, error: error.message };
  }
  revalidatePath("/trainer/content");
  revalidatePath("/prompt-library");
  return { ok: true };
}
