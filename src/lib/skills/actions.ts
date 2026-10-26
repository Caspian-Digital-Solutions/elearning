"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole, requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { skillsCatalogueClient } from "@/lib/skills/db-client";
import {
  normaliseSkillName,
  validateSkillDescription,
  validateSkillFrontMatter,
  validateSkillMdLength,
  validateSkillName,
} from "@/lib/skills/validators";

const usageSchema = z.object({
  skillId: z.string().uuid(),
  skillVersion: z.string().min(1),
  usedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  task: z.string().min(3).max(200),
  outcome: z.enum(["kept", "edited", "discarded"]),
  minutesSaved: z.coerce.number().int().min(0).optional(),
  declaration: z.literal(true),
});

const usageUpdateSchema = usageSchema.extend({
  logId: z.string().uuid(),
});

const versionSchema = z.object({
  skillId: z.string().uuid(),
  version: z.string().regex(/^[0-9]+(\.[0-9]+)?$/),
  changelogMd: z.string().max(8000),
  skillMdText: z.string(),
  testCasesCount: z.coerce.number().int().min(0),
  testCasesPassed: z.coerce.number().int().min(0),
  testNotesMd: z.string().max(4000).optional(),
});

const approvalSchema = z.object({
  versionId: z.string().uuid(),
  decision: z.enum(["approved", "changes_requested"]),
  commentMd: z.string().min(5).max(4000),
});

const liveSchema = z.object({
  skillId: z.string().uuid(),
  liveSince: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const retireSchema = z.object({
  skillId: z.string().uuid(),
  reason: z.string().min(10).max(500),
});

const updateMetaSchema = z.object({
  skillId: z.string().uuid(),
  displayName: z.string().min(1).max(120),
  description: z.string().max(1024),
  howToEnableMd: z.string().max(8000),
  boundariesMd: z.string().max(4000),
  ownerId: z.string().uuid().nullable().optional(),
});

export async function logSkillUsageAction(
  input: z.infer<typeof usageSchema>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = usageSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Check the form and try again." };
  }
  await requireUser();
  const supabase = skillsCatalogueClient(await createClient());
  const { error } = await supabase.rpc("log_skill_usage", {
    p_skill_id: parsed.data.skillId,
    p_skill_version: parsed.data.skillVersion,
    p_used_on: parsed.data.usedOn,
    p_task: parsed.data.task,
    p_outcome: parsed.data.outcome,
    p_minutes_saved: parsed.data.minutesSaved ?? null,
    p_declaration: parsed.data.declaration,
  });
  if (error) {
    return { ok: false, error: error.message };
  }
  revalidatePath("/skills");
  return { ok: true };
}

export async function updateSkillUsageAction(
  input: z.infer<typeof usageUpdateSchema>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = usageUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Check the form and try again." };
  }
  await requireUser();
  const supabase = skillsCatalogueClient(await createClient());
  const { error } = await supabase.rpc("update_skill_usage_log", {
    p_log_id: parsed.data.logId,
    p_used_on: parsed.data.usedOn,
    p_task: parsed.data.task,
    p_outcome: parsed.data.outcome,
    p_minutes_saved: parsed.data.minutesSaved ?? null,
    p_declaration: parsed.data.declaration,
  });
  if (error) {
    return { ok: false, error: error.message };
  }
  revalidatePath("/skills");
  return { ok: true };
}

export async function saveSkillVersionAction(
  input: z.infer<typeof versionSchema> & { catalogueName: string; catalogueDescription: string },
): Promise<{ ok: true; versionId: string } | { ok: false; error: string }> {
  const parsed = versionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Check the version details." };
  }
  const mdError = validateSkillMdLength(parsed.data.skillMdText);
  if (mdError) {
    return { ok: false, error: mdError };
  }
  const fmError = validateSkillFrontMatter(parsed.data.skillMdText, {
    name: input.catalogueName,
    description: input.catalogueDescription,
  });
  if (fmError) {
    return { ok: false, error: fmError };
  }
  await requireUser();
  const supabase = skillsCatalogueClient(await createClient());
  const { data, error } = await supabase.rpc("save_skill_version", {
    p_skill_id: parsed.data.skillId,
    p_version: parsed.data.version,
    p_changelog_md: parsed.data.changelogMd,
    p_skill_md_text: parsed.data.skillMdText,
    p_test_cases_count: parsed.data.testCasesCount,
    p_test_cases_passed: parsed.data.testCasesPassed,
    p_test_notes_md: parsed.data.testNotesMd ?? null,
  });
  if (error) {
    return { ok: false, error: error.message };
  }
  revalidatePath("/trainer/content");
  return { ok: true, versionId: data as string };
}

export async function submitSkillForReviewAction(
  versionId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireUser();
  const supabase = skillsCatalogueClient(await createClient());
  const { error } = await supabase.rpc("submit_skill_for_review", { p_skill_version_id: versionId });
  if (error) {
    return { ok: false, error: error.message };
  }
  revalidatePath("/trainer/content");
  return { ok: true };
}

export async function decideSkillApprovalAction(
  input: z.infer<typeof approvalSchema>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = approvalSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Add a comment and choose approve or request changes." };
  }
  await requireUser();
  const supabase = skillsCatalogueClient(await createClient());
  const { error } = await supabase.rpc("decide_skill_approval", {
    p_skill_version_id: parsed.data.versionId,
    p_decision: parsed.data.decision,
    p_comment_md: parsed.data.commentMd,
  });
  if (error) {
    return { ok: false, error: error.message };
  }
  revalidatePath("/trainer/content");
  return { ok: true };
}

export async function setSkillLiveAction(
  input: z.infer<typeof liveSchema>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = liveSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Choose a valid live date." };
  }
  await requireUser();
  const supabase = skillsCatalogueClient(await createClient());
  const { error } = await supabase.rpc("set_skill_live", {
    p_skill_id: parsed.data.skillId,
    p_live_since: parsed.data.liveSince,
  });
  if (error) {
    return { ok: false, error: error.message };
  }
  revalidatePath("/trainer/content");
  revalidatePath("/skills");
  return { ok: true };
}

export async function retireSkillAction(
  input: z.infer<typeof retireSchema>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = retireSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Add a retirement reason of at least 10 characters." };
  }
  await requireRole(["trainer", "admin"]);
  const supabase = skillsCatalogueClient(await createClient());
  const { error } = await supabase.rpc("retire_skill", {
    p_skill_id: parsed.data.skillId,
    p_reason: parsed.data.reason,
  });
  if (error) {
    return { ok: false, error: error.message };
  }
  revalidatePath("/trainer/content");
  revalidatePath("/skills");
  return { ok: true };
}

export async function updateSkillMetadataAction(
  input: z.infer<typeof updateMetaSchema>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = updateMetaSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Check the catalogue fields." };
  }
  const descError = validateSkillDescription(parsed.data.description);
  if (descError) {
    return { ok: false, error: descError };
  }
  await requireUser();
  const supabase = skillsCatalogueClient(await createClient());
  const { error } = await supabase
    .from("skills")
    .update({
      display_name: parsed.data.displayName,
      description: parsed.data.description,
      how_to_enable_md: parsed.data.howToEnableMd,
      boundaries_md: parsed.data.boundariesMd,
      owner_id: parsed.data.ownerId ?? null,
    })
    .eq("id", parsed.data.skillId);
  if (error) {
    return { ok: false, error: error.message };
  }
  revalidatePath("/trainer/content");
  revalidatePath("/skills");
  return { ok: true };
}

export async function createSkillAction(input: {
  name: string;
  displayName: string;
  departmentId: string;
  description: string;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  await requireRole(["trainer", "admin"]);
  const name = normaliseSkillName(input.name);
  const nameError = validateSkillName(name);
  if (nameError) {
    return { ok: false, error: nameError };
  }
  const descError = validateSkillDescription(input.description);
  if (descError) {
    return { ok: false, error: descError };
  }
  const supabase = skillsCatalogueClient(await createClient());
  const { data, error } = await supabase
    .from("skills")
    .insert({
      name,
      display_name: input.displayName.trim(),
      department_id: input.departmentId,
      description: input.description,
      is_certification_skill: false,
    })
    .select("id")
    .single();
  if (error) {
    return { ok: false, error: error.message };
  }
  revalidatePath("/trainer/content");
  return { ok: true, id: data.id as string };
}
