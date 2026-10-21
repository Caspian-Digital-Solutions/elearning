import "server-only";

import {
  buildLearnerAssessmentPayload,
  type AssessmentRow,
  type ItemRow,
  type SectionRow,
} from "@/lib/assessments/learner-payload";
import { streamNames, type Stream } from "@/lib/people/labels";
import { createClient } from "@/lib/supabase/server";
import type { AttemptStatus } from "@/lib/types/database-assessments";

export type LearnerAssessmentCard = {
  code: string;
  title: string;
  type: string;
  timeGuideMin: number | null;
  instructionsSnippet: string;
  statusLabel: string;
  href: string | null;
  assessmentId: string | null;
};

export type TrainerAssessmentListRow = {
  id: string;
  code: string;
  title: string;
  type: string;
  typeLabel: string;
  statusLabel: string;
  version: number;
  isSample: boolean;
  itemCount: number;
  attemptCount: number;
};

const typeLabels: Record<string, string> = {
  placement: "Placement",
  quiz: "Quiz",
  safety_quiz: "Safety quiz",
  capstone: "Capstone",
};

function statusLabelForAttempt(
  status: AttemptStatus | null,
  confirmed: boolean,
): string {
  if (!status) {
    return "Not started";
  }
  if (status === "in_progress") {
    return "In progress";
  }
  if (confirmed) {
    return "Result ready";
  }
  if (status === "confirmed") {
    return "Result ready";
  }
  if (status === "submitted" || status === "marking" || status === "marked") {
    return "Submitted — being marked";
  }
  return "Not started";
}

export async function loadLearnerAssessmentCards(userId: string): Promise<LearnerAssessmentCard[]> {
  const supabase = await createClient();
  const { data: published } = await supabase
    .from("assessments")
    .select("id, code, title, type, instructions_md, time_guide_min")
    .eq("status", "published")
    .order("code");

  const placement = (published ?? []).find((row) => row.type === "placement");
  const cards: LearnerAssessmentCard[] = [];

  if (placement) {
    const { data: attempts } = await supabase
      .from("attempts")
      .select("id, status, assessment_id")
      .eq("user_id", userId)
      .eq("assessment_id", placement.id)
      .order("started_at", { ascending: false });

    const latest = attempts?.[0] ?? null;
    let confirmed = false;
    if (latest?.status === "confirmed") {
      const { data: pr } = await supabase
        .from("placement_results")
        .select("confirmed_at")
        .eq("attempt_id", latest.id)
        .maybeSingle();
      confirmed = Boolean(pr?.confirmed_at);
    }

    const snippet = placement.instructions_md.trim().split("\n")[0]?.slice(0, 160) ?? "";
    cards.push({
      code: placement.code,
      title: placement.title,
      type: placement.type,
      timeGuideMin: placement.time_guide_min,
      instructionsSnippet: snippet,
      statusLabel: statusLabelForAttempt(latest?.status ?? null, confirmed),
      href:
        latest?.status === "confirmed" || confirmed
          ? `/assessments/${placement.code}`
          : `/assessments/${placement.code}`,
      assessmentId: placement.id,
    });
  }

  return cards;
}

export async function loadPublishedAssessmentByCode(code: string) {
  const supabase = await createClient();
  const { data: assessment, error } = await supabase
    .from("assessments")
    .select(
      "id, code, title, type, instructions_md, time_guide_min, is_sample, version, status",
    )
    .eq("code", code)
    .eq("status", "published")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !assessment) {
    return null;
  }

  const [{ data: sections }, { data: items }] = await Promise.all([
    supabase
      .from("assessment_sections")
      .select("id, code, title, max_score, counts_in_total, sort_order, instructions_md")
      .eq("assessment_id", assessment.id)
      .order("sort_order"),
    supabase
      .from("assessment_items")
      .select(
        "id, ref, type, sort_order, prompt_md, options, response_format, department_id, section_id",
      )
      .eq("assessment_id", assessment.id)
      .order("sort_order"),
  ]);

  const payload = buildLearnerAssessmentPayload(
    assessment as AssessmentRow,
    (sections ?? []) as SectionRow[],
    (items ?? []) as ItemRow[],
  );

  return { assessment, payload };
}

export async function loadUserAttemptForAssessment(userId: string, assessmentId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("attempts")
    .select("*")
    .eq("user_id", userId)
    .eq("assessment_id", assessmentId)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

export async function loadAttemptResponses(attemptId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("responses").select("id, item_id, answer").eq("attempt_id", attemptId);
  return data ?? [];
}

export async function loadConfirmedPlacementResult(userId: string, attemptId: string) {
  const supabase = await createClient();
  const { data: result } = await supabase
    .from("placement_results")
    .select("section_scores, total, confirmed_stream, bridges, gates_failed, confirmed_at, confirmed_by")
    .eq("attempt_id", attemptId)
    .eq("user_id", userId)
    .not("confirmed_at", "is", null)
    .maybeSingle();
  if (!result) {
    return null;
  }
  let confirmer: { full_name: string | null; email: string } | null = null;
  if (result.confirmed_by) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, email")
      .eq("id", result.confirmed_by)
      .maybeSingle();
    confirmer = profile;
  }
  return { ...result, profiles: confirmer };
}

export function streamLabel(stream: Stream | null | undefined): string {
  if (!stream) {
    return "—";
  }
  return streamNames[stream] ?? stream;
}

export async function loadTrainerAssessments(): Promise<TrainerAssessmentListRow[]> {
  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("assessments")
    .select("id, code, title, type, status, version, is_sample")
    .order("code")
    .order("version", { ascending: false });

  if (!rows?.length) {
    return [];
  }

  const ids = rows.map((row) => row.id);
  const [{ data: itemCounts }, { data: attemptCounts }] = await Promise.all([
    supabase.from("assessment_items").select("assessment_id").in("assessment_id", ids),
    supabase.from("attempts").select("assessment_id").in("assessment_id", ids),
  ]);

  const itemsByAssessment = new Map<string, number>();
  for (const row of itemCounts ?? []) {
    itemsByAssessment.set(row.assessment_id, (itemsByAssessment.get(row.assessment_id) ?? 0) + 1);
  }
  const attemptsByAssessment = new Map<string, number>();
  for (const row of attemptCounts ?? []) {
    attemptsByAssessment.set(row.assessment_id, (attemptsByAssessment.get(row.assessment_id) ?? 0) + 1);
  }

  const statusLabels: Record<string, string> = {
    draft: "Draft",
    published: "Published",
    archived: "Archived",
  };

  return rows.map((row) => ({
    id: row.id,
    code: row.code,
    title: row.title,
    type: row.type,
    typeLabel: typeLabels[row.type] ?? row.type,
    statusLabel: statusLabels[row.status] ?? row.status,
    version: row.version,
    isSample: row.is_sample,
    itemCount: itemsByAssessment.get(row.id) ?? 0,
    attemptCount: attemptsByAssessment.get(row.id) ?? 0,
  }));
}

export type MarkingQueueRow = {
  responseId: string;
  attemptId: string;
  userId: string;
  personLabel: string;
  personName: string;
  department: string;
  sectionCode: string;
  sectionTitle: string;
  itemRef: string;
  submittedAt: string;
  marked: boolean;
};

export async function loadWeek0MarkingQueue(hideNames: boolean): Promise<MarkingQueueRow[]> {
  const supabase = await createClient();
  const { data: placement } = await supabase
    .from("assessments")
    .select("id")
    .eq("type", "placement")
    .eq("status", "published")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!placement) {
    return [];
  }

  const { data: attempts } = await supabase
    .from("attempts")
    .select("id, user_id, submitted_at")
    .eq("assessment_id", placement.id)
    .in("status", ["marking", "marked", "confirmed"])
    .order("submitted_at", { ascending: true });

  if (!attempts?.length) {
    return [];
  }

  const userIds = [...new Set(attempts.map((a) => a.user_id))];
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, email, department_id, departments ( code, name )")
    .in("id", userIds);
  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

  const attemptIds = attempts.map((a) => a.id);
  const { data: responses } = await supabase
    .from("responses")
    .select("id, attempt_id, item_id")
    .in("attempt_id", attemptIds);

  const itemIds = [...new Set((responses ?? []).map((r) => r.item_id))];
  const { data: items } = itemIds.length
    ? await supabase
        .from("assessment_items")
        .select("id, ref, type, section_id")
        .in("id", itemIds)
    : { data: [] };
  const sectionIds = [...new Set((items ?? []).map((i) => i.section_id))];
  const { data: sections } = sectionIds.length
    ? await supabase.from("assessment_sections").select("id, code, title").in("id", sectionIds)
    : { data: [] };
  const sectionById = new Map((sections ?? []).map((s) => [s.id, s]));
  const itemById = new Map((items ?? []).map((i) => [i.id, i]));

  const responseIds = (responses ?? []).map((r) => r.id);
  const { data: scores } = responseIds.length
    ? await supabase.from("response_scores").select("response_id, marker_score").in("response_id", responseIds)
    : { data: [] };
  const scoreByResponse = new Map((scores ?? []).map((s) => [s.response_id, s.marker_score]));

  const rows: MarkingQueueRow[] = [];
  let index = 0;
  for (const response of responses ?? []) {
    const item = itemById.get(response.item_id);
    if (!item || (item.type !== "short_text" && item.type !== "practical")) {
      continue;
    }
    const section = sectionById.get(item.section_id);
    const markerScore = scoreByResponse.get(response.id);
    const attempt = attempts.find((a) => a.id === response.attempt_id);
    if (!attempt) {
      continue;
    }
    index += 1;
    const profile = profileById.get(attempt.user_id);
    const deptRow = profile?.departments as { code: string; name: string } | null;
    const personName = profile?.full_name?.trim() || profile?.email || "Learner";
    const dept = deptRow?.name ?? deptRow?.code ?? "—";
    rows.push({
      responseId: response.id,
      attemptId: response.attempt_id,
      userId: attempt.user_id,
      personLabel: hideNames ? `Learner ${String(index).padStart(3, "0")}` : personName,
      personName,
      department: dept,
      sectionCode: section?.code ?? "",
      sectionTitle: section?.title ?? "",
      itemRef: item.ref,
      submittedAt: attempt.submitted_at ?? "",
      marked: markerScore !== null && markerScore !== undefined,
    });
  }

  return rows;
}

export type PlacementTableRow = {
  attemptId: string;
  userId: string;
  personName: string;
  department: string;
  submittedAt: string;
  status: string;
  markingProgress: string;
  sectionScores: string;
  total: string;
  technical: string;
  suggestedBand: string;
  suggestedStream: string;
  gates: string;
  bridges: string;
  domainFlags: string;
  confirmedStream: string;
  confirmedAt: string;
  hasPlacement: boolean;
  fullyMarked: boolean;
};

export async function loadPlacementTableRows(): Promise<PlacementTableRow[]> {
  const supabase = await createClient();
  const { data: placement } = await supabase
    .from("assessments")
    .select("id")
    .eq("type", "placement")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!placement) {
    return [];
  }

  const { data: attempts } = await supabase
    .from("attempts")
    .select("id, user_id, status, submitted_at")
    .eq("assessment_id", placement.id)
    .neq("status", "in_progress")
    .order("submitted_at", { ascending: false });

  const userIds = [...new Set((attempts ?? []).map((a) => a.user_id))];
  const { data: profiles } = userIds.length
    ? await supabase
        .from("profiles")
        .select("id, full_name, email, departments ( name, code )")
        .in("id", userIds)
    : { data: [] };
  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

  const attemptIds = (attempts ?? []).map((a) => a.id);
  const { data: results } = attemptIds.length
    ? await supabase.from("placement_results").select("*").in("attempt_id", attemptIds)
    : { data: [] };

  const resultByAttempt = new Map((results ?? []).map((r) => [r.attempt_id, r]));

  return (attempts ?? []).map((attempt) => {
    const profile = profileById.get(attempt.user_id);
    const deptRow = profile?.departments as { name: string; code: string } | null;
    const pr = resultByAttempt.get(attempt.id);
    const sectionScores = pr?.section_scores as Record<string, number> | undefined;
    const sectionText = sectionScores
      ? Object.entries(sectionScores)
          .map(([code, score]) => `${code}: ${score}`)
          .join("; ")
      : "—";
    const technical = sectionScores?.technical !== undefined ? String(sectionScores.technical) : "—";
    return {
      attemptId: attempt.id,
      userId: attempt.user_id,
      personName: profile?.full_name?.trim() || profile?.email || "—",
      department: deptRow?.name ?? deptRow?.code ?? "—",
      submittedAt: attempt.submitted_at ?? "",
      status: attempt.status,
      markingProgress: attempt.status === "marking" ? "In progress" : attempt.status === "marked" || attempt.status === "confirmed" ? "Complete" : "—",
      sectionScores: sectionText,
      total: pr ? String(pr.total) : "—",
      technical,
      suggestedBand: pr?.suggested_band ?? "—",
      suggestedStream: pr?.suggested_stream ? streamLabel(pr.suggested_stream) : "—",
      gates: pr?.gates_failed?.length ? pr.gates_failed.join(", ") : "—",
      bridges: pr?.bridges?.length ? pr.bridges.join(", ") : "—",
      domainFlags: pr?.required_domain_flags?.length ? pr.required_domain_flags.join(", ") : "—",
      confirmedStream: pr?.confirmed_stream ? streamLabel(pr.confirmed_stream) : "—",
      confirmedAt: pr?.confirmed_at ?? "",
      hasPlacement: Boolean(pr),
      fullyMarked: attempt.status === "marked" || attempt.status === "confirmed",
    };
  });
}
