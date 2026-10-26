import "server-only";

import { createClient } from "@/lib/supabase/server";
import { promptLibraryClient } from "@/lib/prompts/db-client";
import { formatDate } from "@/lib/format";
import { riskTierLabels } from "@/lib/prompts/risk-tier";
import type { AiTool, PromptRow, RiskTier } from "@/lib/prompts/types";

export type LearnerPromptCard = {
  id: string;
  slug: string;
  title: string;
  tool: string;
  department: string;
  taskType: string;
  riskTier: string;
  testedLabel: string;
};

export type TrainerPromptListRow = {
  id: string;
  title: string;
  department: string;
  taskType: string;
  tool: string;
  riskTier: string;
  status: string;
  version: string;
  owner: string;
  copies: string;
  feedbackWorked: string;
  feedbackEdits: string;
  feedbackFailed: string;
  lastTested: string;
};

function toolLabel(tool: AiTool): string {
  if (tool === "chatgpt") {
    return "ChatGPT";
  }
  if (tool === "perplexity") {
    return "Perplexity";
  }
  return "Claude";
}

export async function loadTaskTypes(): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("app_settings").select("value").eq("key", "library.task_types").maybeSingle();
  const value = data?.value;
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }
  return [
    "research",
    "drafting",
    "editing",
    "summarising",
    "analysis",
    "reporting",
    "planning",
    "ideation",
    "quality check",
    "meeting notes",
  ];
}

export async function loadLearnerPrompts(filters: {
  query?: string;
  departmentId?: string | null;
  taskType?: string;
  tool?: string;
  moduleId?: string;
  riskTier?: string;
  userDepartmentId: string | null;
}): Promise<LearnerPromptCard[]> {
  const base = await createClient();
  const supabase = promptLibraryClient(base);
  let q = supabase.from("prompts").select("*").eq("status", "tested").order("title");

  if (filters.departmentId === "mine") {
    if (filters.userDepartmentId) {
      q = q.or(`department_id.is.null,department_id.eq.${filters.userDepartmentId}`);
    } else {
      q = q.is("department_id", null);
    }
  } else if (filters.departmentId === "all") {
    // no filter
  } else if (filters.departmentId) {
    q = q.eq("department_id", filters.departmentId);
  } else if (filters.userDepartmentId) {
    q = q.or(`department_id.is.null,department_id.eq.${filters.userDepartmentId}`);
  } else {
    q = q.is("department_id", null);
  }

  if (filters.taskType) {
    q = q.eq("task_type", filters.taskType);
  }
  if (filters.tool) {
    q = q.eq("tool", filters.tool);
  }
  if (filters.moduleId) {
    q = q.eq("module_id", filters.moduleId);
  }
  if (filters.riskTier) {
    q = q.eq("risk_tier", filters.riskTier);
  }

  const { data, error } = await q;
  if (error) {
    throw new Error("Could not load prompts.");
  }

  const rows = (data as PromptRow[] | null) ?? [];
  const deptIds = [...new Set(rows.map((r) => r.department_id).filter(Boolean))] as string[];
  const { data: deptRows } = deptIds.length
    ? await base.from("departments").select("id, name").in("id", deptIds)
    : { data: [] };
  const deptMap = new Map((deptRows ?? []).map((d) => [d.id, d.name]));

  const needle = filters.query?.trim().toLowerCase();
  return rows
    .filter((row) => {
      if (!needle) {
        return true;
      }
      const hay = `${row.title} ${row.task_type} ${row.body} ${row.usage_notes_md}`.toLowerCase();
      return hay.includes(needle);
    })
    .map((row) => ({
      id: row.id,
      slug: row.slug,
      title: row.title,
      tool: toolLabel(row.tool as AiTool),
      department: (row.department_id ? deptMap.get(row.department_id) : null) ?? "Everyone",
      taskType: row.task_type,
      riskTier: riskTierLabels[row.risk_tier as RiskTier],
      testedLabel: `Tested ${formatDate(row.tested_at)} · v${row.version}`,
    }));
}

export async function loadPromptBySlug(slug: string): Promise<PromptRow | null> {
  const supabase = promptLibraryClient(await createClient());
  const { data } = await supabase
    .from("prompts")
    .select("*")
    .eq("slug", slug)
    .eq("status", "tested")
    .maybeSingle();
  return data as PromptRow | null;
}

export async function loadTrainerPrompts(): Promise<TrainerPromptListRow[]> {
  const base = await createClient();
  const supabase = promptLibraryClient(base);
  const { data: promptsRaw, error } = await supabase.from("prompts").select("*").order("title");
  if (error) {
    throw new Error("Could not load prompts.");
  }
  const prompts = (promptsRaw ?? []) as PromptRow[];

  const deptIds = [...new Set(prompts.map((p) => p.department_id).filter(Boolean))] as string[];
  const ownerIds = [...new Set(prompts.map((p) => p.owner_id).filter(Boolean))] as string[];
  const { data: deptRows } = deptIds.length
    ? await base.from("departments").select("id, name").in("id", deptIds)
    : { data: [] };
  const { data: ownerRows } = ownerIds.length
    ? await base.from("profiles").select("id, full_name").in("id", ownerIds)
    : { data: [] };
  const deptMap = new Map((deptRows ?? []).map((d) => [d.id, d.name]));
  const ownerMap = new Map((ownerRows ?? []).map((o) => [o.id, o.full_name]));

  const ids = prompts.map((p) => p.id);
  const copyMap = new Map<string, number>();
  const feedbackMap = new Map<string, { worked: number; edits: number; failed: number }>();

  if (ids.length) {
    const { data: copies } = await supabase.from("prompt_copies").select("prompt_id").in("prompt_id", ids);
    for (const row of (copies ?? []) as { prompt_id: string }[]) {
      copyMap.set(row.prompt_id, (copyMap.get(row.prompt_id) ?? 0) + 1);
    }
    const { data: feedback } = await supabase
      .from("prompt_feedback")
      .select("prompt_id, outcome")
      .in("prompt_id", ids);
    for (const row of (feedback ?? []) as { prompt_id: string; outcome: string }[]) {
      const bucket = feedbackMap.get(row.prompt_id) ?? { worked: 0, edits: 0, failed: 0 };
      if (row.outcome === "worked") {
        bucket.worked += 1;
      } else if (row.outcome === "needed_edits") {
        bucket.edits += 1;
      } else if (row.outcome === "did_not_work") {
        bucket.failed += 1;
      }
      feedbackMap.set(row.prompt_id, bucket);
    }
  }

  return prompts.map((row) => {
    const fb = feedbackMap.get(row.id) ?? { worked: 0, edits: 0, failed: 0 };
    return {
      id: row.id,
      title: row.title,
      department: (row.department_id ? deptMap.get(row.department_id) : null) ?? "Everyone",
      taskType: row.task_type,
      tool: toolLabel(row.tool as AiTool),
      riskTier: riskTierLabels[row.risk_tier as RiskTier],
      status: String(row.status).replaceAll("_", " "),
      version: String(row.version),
      owner: (row.owner_id ? ownerMap.get(row.owner_id) ?? "" : "").trim() || "—",
      copies: String(copyMap.get(row.id) ?? 0),
      feedbackWorked: String(fb.worked),
      feedbackEdits: String(fb.edits),
      feedbackFailed: String(fb.failed),
      lastTested: row.tested_at ? formatDate(row.tested_at) : "—",
    };
  });
}

export async function loadReviewQueue() {
  const base = await createClient();
  const supabase = promptLibraryClient(base);
  const { data: rows } = await supabase
    .from("prompts")
    .select("id, title, submit_notes_md, submitted_by")
    .eq("status", "in_review")
    .order("updated_at", { ascending: false });
  type ReviewRow = {
    id: string;
    title: string;
    submit_notes_md: string | null;
    submitted_by: string | null;
  };
  const list = (rows as ReviewRow[] | null) ?? [];
  const submitterIds = [...new Set(list.map((r) => r.submitted_by).filter(Boolean))] as string[];
  const { data: profiles } = submitterIds.length
    ? await base.from("profiles").select("id, full_name").in("id", submitterIds)
    : { data: [] };
  const nameMap = new Map(
    ((profiles ?? []) as { id: string; full_name: string | null }[]).map((p) => [p.id, p.full_name]),
  );
  return list.map((row) => ({
    id: row.id,
    title: row.title,
    submit_notes_md: row.submit_notes_md,
    submitter: row.submitted_by ? { full_name: nameMap.get(row.submitted_by) ?? null } : null,
  }));
}
