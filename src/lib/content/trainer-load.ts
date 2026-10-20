import "server-only";

import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/format";

export async function loadOwnerOptions() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name")
    .in("role", ["trainer", "admin", "manager"])
    .eq("is_active", true)
    .order("full_name");
  return (data ?? []).map((row) => ({ id: row.id, name: row.full_name ?? "Unnamed" }));
}

export async function loadPageEditorData(pageId: string) {
  const supabase = await createClient();
  const { data: page } = await supabase.from("pages").select("*").eq("id", pageId).maybeSingle();
  if (!page) {
    return null;
  }
  const { data: draft } = await supabase
    .from("content_drafts")
    .select("*")
    .eq("content_type", "page")
    .eq("content_id", pageId)
    .maybeSingle();

  const meta = (draft?.metadata ?? {}) as Record<string, unknown>;

  const { data: revisions } = await supabase
    .from("content_revisions")
    .select("revision_no, title, body_md, change_note, published_at, published_by")
    .eq("content_type", "page")
    .eq("content_id", pageId)
    .order("revision_no", { ascending: false });

  const publisherIds = [...new Set((revisions ?? []).map((r) => r.published_by).filter(Boolean))] as string[];
  const { data: publishers } = publisherIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", publisherIds)
    : { data: [] };
  const publisherMap = new Map((publishers ?? []).map((p) => [p.id, p.full_name ?? "Someone"]));

  let pendingPeople: { name: string; department: string; lastSeen: string }[] = [];
  if (page.requires_acknowledgement && page.status === "published") {
    const { data: active } = await supabase
      .from("profiles")
      .select("id, full_name, last_seen_at, departments ( name )")
      .eq("is_active", true);
    const { data: acks } = await supabase
      .from("page_acknowledgements")
      .select("user_id")
      .eq("page_id", pageId)
      .eq("version", page.version);
    const ackSet = new Set((acks ?? []).map((a) => a.user_id));
    pendingPeople = (active ?? [])
      .filter((p) => !ackSet.has(p.id))
      .map((p) => ({
        name: p.full_name ?? "Unnamed",
        department: (p.departments as { name?: string } | null)?.name ?? "—",
        lastSeen: p.last_seen_at ? formatDateTime(p.last_seen_at) : "—",
      }));
  }

  return {
    pageId,
    initial: {
      title: draft?.title ?? page.title,
      slug: String(meta.slug ?? page.slug),
      bodyMd: draft?.body_md ?? page.body_md,
      ownerId: (meta.owner_id as string | null) ?? page.owner_id,
      reviewBy: String(meta.review_by ?? page.review_by ?? ""),
      requiresAcknowledgement: Boolean(meta.requires_acknowledgement ?? page.requires_acknowledgement),
      sortOrder: Number(meta.sort_order ?? page.sort_order ?? 0),
      version: page.version,
      publishedAt: page.published_at,
      slugLocked: Boolean(page.published_at),
    },
    revisions: (revisions ?? []).map((rev) => ({
      revisionNo: rev.revision_no,
      publishedAt: rev.published_at,
      publisher: rev.published_by ? publisherMap.get(rev.published_by) ?? "Someone" : "Someone",
      changeNote: rev.change_note,
      title: rev.title,
      bodyMd: rev.body_md,
    })),
    pendingPeople,
  };
}

export async function loadUpdateEditorData(updateId: string) {
  const supabase = await createClient();
  const { data: update } = await supabase.from("updates").select("*").eq("id", updateId).maybeSingle();
  if (!update) {
    return null;
  }
  const { data: draft } = await supabase
    .from("content_drafts")
    .select("*")
    .eq("content_type", "update")
    .eq("content_id", updateId)
    .maybeSingle();
  const meta = (draft?.metadata ?? {}) as Record<string, unknown>;

  const { data: revisions } = await supabase
    .from("content_revisions")
    .select("revision_no, body_md, change_note, published_at")
    .eq("content_type", "update")
    .eq("content_id", updateId)
    .order("revision_no", { ascending: false });

  return {
    updateId,
    initial: {
      title: draft?.title ?? update.title,
      slug: String(meta.slug ?? update.slug ?? ""),
      bodyMd: draft?.body_md ?? update.body_md,
      tools: (meta.tools as string[] | undefined) ?? update.tools ?? [],
      actionRequired: Boolean(meta.action_required ?? update.action_required),
      actionText: String(meta.action_text ?? update.action_text ?? ""),
      actionDue: String(meta.action_due ?? update.action_due ?? ""),
      version: update.version,
      publishedAt: update.published_at,
      slugLocked: Boolean(update.published_at),
    },
    revisions: (revisions ?? []).map((rev) => ({
      revisionNo: rev.revision_no,
      publishedAt: rev.published_at,
      publisher: "",
      changeNote: rev.change_note,
      bodyMd: rev.body_md,
    })),
  };
}
