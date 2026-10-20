"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { authorise } from "@/lib/auth";
import { databaseMessage, notAllowed, type ActionResult } from "@/lib/actions/result";
import { validateSlug } from "@/lib/content/slug";
import { isUpdateTool } from "@/lib/content/tools";
import { createClient } from "@/lib/supabase/server";

const trainersAndAdmins = ["trainer", "admin"] as const;

const changeNote = z
  .string()
  .trim()
  .min(5, { error: "Add a change note of at least five characters." })
  .max(500);

const pageDraftInput = z.strictObject({
  id: z.uuid().optional(),
  title: z.string().trim().min(1, { error: "Enter a title." }).max(200),
  slug: z.string().trim().min(1),
  bodyMd: z.string().max(200_000),
  ownerId: z.uuid().nullable(),
  reviewBy: z
    .union([z.iso.date(), z.literal("")])
    .transform((v) => v || null),
  requiresAcknowledgement: z.boolean(),
  sortOrder: z.number().int().min(0).max(9999),
});

const updateDraftInput = z.strictObject({
  id: z.uuid().optional(),
  title: z.string().trim().min(1).max(200),
  slug: z.string().trim().min(1),
  bodyMd: z.string().max(200_000),
  tools: z.array(z.string()),
  actionRequired: z.boolean(),
  actionText: z.string().max(2000).optional(),
  actionDue: z
    .union([z.iso.date(), z.literal("")])
    .transform((v) => v || null),
});

function parseSlug(slug: string) {
  const check = validateSlug(slug);
  if (!check.ok) {
    return { ok: false as const, error: check.error };
  }
  return { ok: true as const, value: slug };
}

export async function savePageDraft(input: z.input<typeof pageDraftInput>): Promise<ActionResult<{ id: string }>> {
  if (!(await authorise(trainersAndAdmins))) {
    return { ok: false, error: notAllowed };
  }
  const parsed = pageDraftInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form." };
  }
  const slugCheck = parseSlug(parsed.data.slug);
  if (!slugCheck.ok) {
    return { ok: false, error: slugCheck.error };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: notAllowed };
  }

  let pageId = parsed.data.id;
  if (!pageId) {
    const { data: created, error } = await supabase
      .from("pages")
      .insert({
        slug: slugCheck.value,
        title: parsed.data.title,
        body_md: "",
        status: "draft",
        sort_order: parsed.data.sortOrder,
        owner_id: parsed.data.ownerId,
        review_by: parsed.data.reviewBy,
        requires_acknowledgement: parsed.data.requiresAcknowledgement,
      })
      .select("id")
      .single();
    if (error) {
      return { ok: false, error: databaseMessage(error, "The page was not saved.") };
    }
    pageId = created.id;
  } else {
    const { data: existing } = await supabase.from("pages").select("status, published_at").eq("id", pageId).maybeSingle();
    const { error } = await supabase
      .from("pages")
      .update({
        sort_order: parsed.data.sortOrder,
        owner_id: parsed.data.ownerId,
        review_by: parsed.data.reviewBy,
        requires_acknowledgement: parsed.data.requiresAcknowledgement,
        ...(!existing?.published_at
          ? { slug: slugCheck.value, title: parsed.data.title }
          : {}),
      })
      .eq("id", pageId);
    if (error) {
      return { ok: false, error: databaseMessage(error, "The page was not saved.") };
    }
  }

  const metadata = {
    slug: slugCheck.value,
    owner_id: parsed.data.ownerId,
    review_by: parsed.data.reviewBy,
    requires_acknowledgement: parsed.data.requiresAcknowledgement,
    sort_order: parsed.data.sortOrder,
  };

  const { error: draftError } = await supabase.from("content_drafts").upsert(
    {
      content_type: "page",
      content_id: pageId,
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
  revalidatePath(`/trainer/content/pages/${pageId}`);
  return { ok: true, data: { id: pageId } };
}

export async function publishPage(input: {
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
    p_type: "page",
    p_id: input.id,
    p_change_note: note.data,
  });
  if (error) {
    return { ok: false, error: databaseMessage(error, "Publish did not complete.") };
  }
  revalidatePath("/", "layout");
  return { ok: true, data: { version: data as number } };
}

export async function unpublishPage(input: { id: string; reason: string }): Promise<ActionResult> {
  if (!(await authorise(trainersAndAdmins))) {
    return { ok: false, error: notAllowed };
  }
  const reason = changeNote.safeParse(input.reason);
  if (!reason.success) {
    return { ok: false, error: reason.error.issues[0]?.message ?? "Add a reason." };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("unpublish_content", {
    p_type: "page",
    p_id: input.id,
    p_reason: reason.data,
  });
  if (error) {
    return { ok: false, error: databaseMessage(error, "Unpublish did not complete.") };
  }
  revalidatePath("/", "layout");
  return { ok: true, data: null };
}

export async function restorePageRevision(input: {
  id: string;
  revisionNo: number;
}): Promise<ActionResult> {
  if (!(await authorise(trainersAndAdmins))) {
    return { ok: false, error: notAllowed };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("restore_revision", {
    p_type: "page",
    p_id: input.id,
    p_revision_no: input.revisionNo,
  });
  if (error) {
    return { ok: false, error: databaseMessage(error, "Restore did not complete.") };
  }
  revalidatePath(`/trainer/content/pages/${input.id}`);
  return { ok: true, data: null };
}

export async function saveUpdateDraft(input: z.input<typeof updateDraftInput>): Promise<ActionResult<{ id: string }>> {
  if (!(await authorise(trainersAndAdmins))) {
    return { ok: false, error: notAllowed };
  }
  const parsed = updateDraftInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form." };
  }
  const tools = parsed.data.tools.filter(isUpdateTool);
  const slugCheck = parseSlug(parsed.data.slug);
  if (!slugCheck.ok) {
    return { ok: false, error: slugCheck.error };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: notAllowed };
  }

  let updateId = parsed.data.id;
  if (!updateId) {
    const { data: created, error } = await supabase
      .from("updates")
      .insert({
        title: parsed.data.title,
        slug: slugCheck.value,
        body_md: "",
        status: "draft",
        tools,
        action_required: parsed.data.actionRequired,
        action_text: parsed.data.actionText ?? null,
        action_due: parsed.data.actionDue,
      })
      .select("id")
      .single();
    if (error) {
      return { ok: false, error: databaseMessage(error, "The update was not saved.") };
    }
    updateId = created.id;
  }

  const metadata = {
    slug: slugCheck.value,
    tools,
    action_required: parsed.data.actionRequired,
    action_text: parsed.data.actionText ?? "",
    action_due: parsed.data.actionDue,
  };

  const { error: draftError } = await supabase.from("content_drafts").upsert(
    {
      content_type: "update",
      content_id: updateId,
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
  return { ok: true, data: { id: updateId } };
}

export async function publishUpdate(input: {
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
    p_type: "update",
    p_id: input.id,
    p_change_note: note.data,
  });
  if (error) {
    return { ok: false, error: databaseMessage(error, "Publish did not complete.") };
  }
  revalidatePath("/", "layout");
  return { ok: true, data: { version: data as number } };
}

export async function restoreUpdateRevision(input: {
  id: string;
  revisionNo: number;
}): Promise<ActionResult> {
  if (!(await authorise(trainersAndAdmins))) {
    return { ok: false, error: notAllowed };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("restore_revision", {
    p_type: "update",
    p_id: input.id,
    p_revision_no: input.revisionNo,
  });
  if (error) {
    return { ok: false, error: databaseMessage(error, "Restore did not complete.") };
  }
  revalidatePath(`/trainer/content/updates/${input.id}`);
  return { ok: true, data: null };
}

export async function confirmHelpPage(pageId: string, version: number): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: notAllowed };
  }
  const { error } = await supabase.from("page_acknowledgements").insert({
    user_id: user.id,
    page_id: pageId,
    version,
  });
  if (error) {
    return { ok: false, error: databaseMessage(error, "Confirmation was not saved.") };
  }
  revalidatePath("/", "layout");
  return { ok: true, data: null };
}

export async function markWhatChangedSeen(): Promise<void> {
  const supabase = await createClient();
  await supabase.rpc("mark_updates_seen");
}
