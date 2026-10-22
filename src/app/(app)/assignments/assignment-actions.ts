"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { databaseMessage, type ActionResult } from "@/lib/actions/result";
import { blockSampleContentInProduction } from "@/lib/security/production-content";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { isAllowedSubmissionLink } from "@/lib/assignments/validators";
import { createAssignmentsClient } from "@/lib/supabase/assignments-client";

const submitInput = z.strictObject({
  assignmentId: z.uuid(),
  linkUrl: z.string().max(2000).optional(),
  filePath: z.string().max(500).optional(),
  textMd: z.string().max(100_000).optional(),
  dataDeclaration: z.literal(true),
});

export async function submitAssignment(input: z.input<typeof submitInput>): Promise<ActionResult> {
  const user = await requireUser();
  const limited = await enforceRateLimit("assignment.submit", user.id);
  if (limited) {
    return { ok: false, error: limited };
  }
  const parsed = submitInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Check the form and confirm the declaration." };
  }
  if (parsed.data.linkUrl && !isAllowedSubmissionLink(parsed.data.linkUrl)) {
    return { ok: false, error: "Use a Claude or Google Docs link (https only)." };
  }

  const supabase = await createAssignmentsClient();
  const { data: assignment } = await supabase
    .from("assignments")
    .select("is_sample")
    .eq("id", parsed.data.assignmentId)
    .maybeSingle();
  const sampleBlock = blockSampleContentInProduction(Boolean(assignment?.is_sample));
  if (sampleBlock) {
    return { ok: false, error: sampleBlock };
  }
  const { error } = await supabase.rpc("submit_assignment", {
    p_assignment_id: parsed.data.assignmentId,
    p_link_url: parsed.data.linkUrl ?? undefined,
    p_file_path: parsed.data.filePath ?? undefined,
    p_text_md: parsed.data.textMd ?? undefined,
    p_data_declaration: true,
  });
  if (error) {
    return { ok: false, error: databaseMessage(error, "The assignment could not be submitted.") };
  }
  revalidatePath("/assignments");
  revalidatePath(`/assignments/${parsed.data.assignmentId}`);
  revalidatePath("/my-path");
  return { ok: true, data: null };
}

export async function prepareSubmissionUpload(
  assignmentId: string,
  fileName: string,
  mimeType: string,
  byteSize: number,
): Promise<ActionResult<{ path: string }>> {
  const user = await requireUser();
  const limited = await enforceRateLimit("assignment.upload", user.id);
  if (limited) {
    return { ok: false, error: limited };
  }
  const supabase = await createAssignmentsClient();
  const { data: assignment } = await supabase
    .from("assignments")
    .select("is_sample")
    .eq("id", assignmentId)
    .maybeSingle();
  const sampleBlock = blockSampleContentInProduction(Boolean(assignment?.is_sample));
  if (sampleBlock) {
    return { ok: false, error: sampleBlock };
  }
  const { data, error } = await supabase.rpc("upload_submission_file", {
    p_assignment_id: assignmentId,
    p_filename: fileName,
    p_mime_type: mimeType,
    p_byte_size: byteSize,
  });
  if (error || !data) {
    return { ok: false, error: databaseMessage(error, "The file could not be prepared for upload.") };
  }
  return { ok: true, data: { path: data as string } };
}
