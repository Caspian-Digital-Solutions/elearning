import "server-only";

import { createClient } from "@/lib/supabase/server";
import { formatAcknowledgementCount, countAcknowledged } from "@/lib/content/acknowledgements";
import { formatDate, formatDateTime } from "@/lib/format";

export type PageListRow = {
  id: string;
  title: string;
  slug: string;
  statusLabel: string;
  version: string;
  owner: string;
  reviewBy: string;
  lastPublished: string;
  acknowledgements: string;
};

export type UpdateListRow = {
  id: string;
  title: string;
  tools: string;
  actionRequired: string;
  due: string;
  statusLabel: string;
  published: string;
};

function pageStatusLabel(
  status: string,
  hasDraft: boolean,
): string {
  if (status === "archived") {
    return "Archived";
  }
  if (status === "draft") {
    return "Draft";
  }
  if (hasDraft) {
    return "Published with unsaved changes";
  }
  return "Published";
}

export async function loadTrainerPages(): Promise<PageListRow[]> {
  const supabase = await createClient();
  const { data: pages, error } = await supabase
    .from("pages")
    .select(
      "id, slug, title, version, status, review_by, published_at, requires_acknowledgement, owner_id, owner:profiles!pages_owner_id_fkey ( full_name ), publisher:profiles!pages_published_by_fkey ( full_name )",
    )
    .order("sort_order")
    .order("title");
  if (error || !pages) {
    return [];
  }

  const { data: drafts } = await supabase.from("content_drafts").select("content_id").eq("content_type", "page");
  const draftIds = new Set((drafts ?? []).map((d) => d.content_id));

  const { count: activeCount } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("is_active", true);

  const rows: PageListRow[] = [];
  for (const page of pages) {
    let acknowledgements = "";
    if (page.requires_acknowledgement && page.status === "published") {
      const { data: acks } = await supabase
        .from("page_acknowledgements")
        .select("user_id")
        .eq("page_id", page.id)
        .eq("version", page.version);
      const { data: activeIds } = await supabase.from("profiles").select("id").eq("is_active", true);
      const activeSet = new Set((activeIds ?? []).map((p) => p.id));
      const confirmed = countAcknowledged(acks ?? [], activeSet);
      acknowledgements = formatAcknowledgementCount(confirmed, activeCount ?? 0);
    }

    const lastPublished =
      page.published_at
        ? `${formatDate(page.published_at)} · ${(page as { publisher?: { full_name: string | null } }).publisher?.full_name ?? "Someone"}`
        : "—";

    rows.push({
      id: page.id,
      title: page.title,
      slug: page.slug,
      statusLabel: pageStatusLabel(page.status, draftIds.has(page.id)),
      version: String(page.version),
      owner: (page as { owner?: { full_name: string | null } }).owner?.full_name ?? "—",
      reviewBy: formatDate(page.review_by),
      lastPublished,
      acknowledgements,
    });
  }
  return rows;
}

export async function loadTrainerUpdates(): Promise<UpdateListRow[]> {
  const supabase = await createClient();
  const { data: updates } = await supabase
    .from("updates")
    .select("id, title, tools, action_required, action_due, status, published_at")
    .order("published_at", { ascending: false, nullsFirst: true })
    .order("title");
  if (!updates) {
    return [];
  }
  return updates.map((row) => ({
    id: row.id,
    title: row.title,
    tools: (row.tools ?? []).join(", ") || "—",
    actionRequired: row.action_required ? "Yes" : "No",
    due: formatDate(row.action_due),
    statusLabel: row.status === "archived" ? "Archived" : row.status === "published" ? "Published" : "Draft",
    published: row.published_at ? formatDate(row.published_at) : "—",
  }));
}

export async function countUnreadUpdates(userId: string, seenAt: string | null): Promise<number> {
  const supabase = await createClient();
  let query = supabase
    .from("updates")
    .select("id", { count: "exact", head: true })
    .eq("status", "published")
    .not("published_at", "is", null)
    .lte("published_at", new Date().toISOString());
  if (seenAt) {
    query = query.gt("published_at", seenAt);
  }
  const { count } = await query;
  return count ?? 0;
}

export async function loadPublishedHelpPages(query?: string) {
  const supabase = await createClient();
  const trimmed = query?.trim();
  const { data, error } = await supabase.rpc("search_help_pages", {
    p_query: trimmed && trimmed.length > 0 ? trimmed : "",
  });
  if (error || !data) {
    return [];
  }
  return data as Array<{
    id: string;
    slug: string;
    title: string;
    body_md: string;
    version: number;
    published_at: string | null;
    updated_at: string;
  }>;
}

export function teaserFromMarkdown(body: string): string {
  const line = body
    .split("\n")
    .map((l) => l.replace(/^#+\s*/, "").replace(/^>\s*/, "").trim())
    .find((l) => l.length > 0);
  return line?.slice(0, 160) ?? "";
}

export async function loadHelpPageBySlug(slug: string) {
  const supabase = await createClient();
  const { data: page } = await supabase
    .from("pages")
    .select(
      "id, slug, title, body_md, version, review_by, published_at, requires_acknowledgement, owner_id, profiles!pages_owner_id_fkey ( full_name )",
    )
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  return page;
}

export async function loadPublishedUpdates(filters?: { tool?: string; actionOnly?: boolean }) {
  const supabase = await createClient();
  let query = supabase
    .from("updates")
    .select("id, slug, title, body_md, tools, action_required, action_text, action_due, published_at")
    .eq("status", "published")
    .not("published_at", "is", null)
    .lte("published_at", new Date().toISOString())
    .order("published_at", { ascending: false });
  if (filters?.actionOnly) {
    query = query.eq("action_required", true);
  }
  if (filters?.tool) {
    query = query.contains("tools", [filters.tool]);
  }
  const { data } = await query;
  return data ?? [];
}

export async function loadUpdateBySlug(slug: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("updates")
    .select("*")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  return data;
}

export async function needsAcknowledgementBanner(userId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data: pages } = await supabase
    .from("pages")
    .select("id, version")
    .eq("status", "published")
    .eq("requires_acknowledgement", true);
  if (!pages?.length) {
    return false;
  }
  for (const page of pages) {
    const { data: ack } = await supabase
      .from("page_acknowledgements")
      .select("id")
      .eq("user_id", userId)
      .eq("page_id", page.id)
      .eq("version", page.version)
      .maybeSingle();
    if (!ack) {
      return true;
    }
  }
  return false;
}

export async function loadUserAcknowledgement(userId: string, pageId: string, version: number) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("page_acknowledgements")
    .select("acknowledged_at")
    .eq("user_id", userId)
    .eq("page_id", pageId)
    .eq("version", version)
    .maybeSingle();
  return data;
}

export { formatDate, formatDateTime };
