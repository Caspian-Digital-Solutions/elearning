import "server-only";

import {
  buildLearnerAssessmentPayload,
  type AssessmentRow,
  type ItemRow,
  type SectionRow,
} from "@/lib/assessments/learner-payload";
import {
  attemptsRemaining,
  correctCountFromPercentage,
  countCompletedAttempts,
  formatQuizLearnerStatusLabel,
  formatQuizOutcomeLabel,
  pickBestQuizAttempt,
  quizHasPassMark,
  type QuizAttemptOutcome,
} from "@/lib/assessments/quiz-status";
import { formatDateTime } from "@/lib/format";
import { markdownSnippet } from "@/lib/markdown-snippet";
import { streamNames, type Stream } from "@/lib/people/labels";
import { createClient } from "@/lib/supabase/server";
import type { AttemptStatus } from "@/lib/types/database-assessments";

export type LearnerAssessmentCard = {
  code: string;
  title: string;
  type: string;
  timeGuideMin: number | null;
  instructionsSnippet: string;
  instructionsMarkdown?: string;
  statusLabel: string;
  href: string | null;
  assessmentId: string | null;
};

export type ModuleQuizCard = {
  code: string;
  title: string;
  assessmentId: string;
  moduleCode: string;
  type: "quiz" | "safety_quiz";
  passMarkPct: number | null;
  statusLabel: string;
  href: string;
  canStart: boolean;
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
  moduleCode: string;
  passMarkPct: string;
  maxAttempts: string;
  itemsPerAttempt: string;
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

    const snippet = markdownSnippet(placement.instructions_md);
    cards.push({
      code: placement.code,
      title: placement.title,
      type: placement.type,
      timeGuideMin: placement.time_guide_min,
      instructionsSnippet: snippet,
      instructionsMarkdown: placement.instructions_md,
      statusLabel: statusLabelForAttempt(latest?.status ?? null, confirmed),
      href:
        latest?.status === "confirmed" || confirmed
          ? `/assessments/${placement.code}`
          : `/assessments/${placement.code}`,
      assessmentId: placement.id,
    });
  }

  const quizCards = await loadPublishedQuizzesForLearner(userId);
  for (const quiz of quizCards) {
    cards.push({
      code: quiz.code,
      title: quiz.title,
      type: quiz.type,
      timeGuideMin: null,
      instructionsSnippet: quiz.type === "safety_quiz"
        ? `Safety quiz — ${quiz.passMarkPct ?? 0}% to pass`
        : "5-question check",
      statusLabel: quiz.statusLabel,
      href: quiz.href,
      assessmentId: quiz.assessmentId,
    });
  }

  return cards;
}

export async function loadPublishedAssessmentByCode(
  code: string,
  attempt?: { item_ids?: string[] | null } | null,
) {
  const supabase = await createClient();
  const { data: assessment, error } = await supabase
    .from("assessments")
    .select(
      "id, code, title, type, instructions_md, time_guide_min, is_sample, version, status, pass_mark_pct, max_attempts, show_review_after_submit, items_per_attempt, module_id",
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
        "id, ref, type, sort_order, prompt_md, options, response_format, department_id, section_id, allow_multiple",
      )
      .eq("assessment_id", assessment.id)
      .order("sort_order"),
  ]);

  const payload = buildPayloadForAttempt(
    assessment as AssessmentRow,
    (sections ?? []) as SectionRow[],
    (items ?? []) as ItemRow[],
    attempt ?? null,
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

export async function loadUserAttemptsForAssessment(userId: string, assessmentId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("attempts")
    .select("*")
    .eq("user_id", userId)
    .eq("assessment_id", assessmentId)
    .order("started_at", { ascending: false });
  return data ?? [];
}

export function buildPayloadForAttempt(
  assessment: AssessmentRow & { type: string },
  sections: SectionRow[],
  items: ItemRow[],
  attempt: { item_ids?: string[] | null } | null,
) {
  const isQuiz = assessment.type === "quiz" || assessment.type === "safety_quiz";
  const itemIds = attempt?.item_ids?.length ? attempt.item_ids : undefined;
  return buildLearnerAssessmentPayload(assessment, sections, items, isQuiz ? { itemIds } : undefined);
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
    .select(
      "id, code, title, type, status, version, is_sample, pass_mark_pct, max_attempts, items_per_attempt, modules ( code )",
    )
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

  return rows.map((row) => {
    const moduleRow = row.modules as { code: string } | null;
    return {
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
      moduleCode: moduleRow?.code ?? "—",
      passMarkPct: row.pass_mark_pct !== null ? `${row.pass_mark_pct}%` : "—",
      maxAttempts: row.max_attempts !== null ? String(row.max_attempts) : "Unlimited",
      itemsPerAttempt: row.items_per_attempt !== null ? String(row.items_per_attempt) : "All",
    };
  });
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
  scoreKnowledge: string;
  scorePrompting: string;
  scoreDepartment: string;
  scoreSafety: string;
  scoreWorkflow: string;
  total: string;
  technical: string;
  suggestedBand: string;
  suggestedStream: string;
  gates: string;
  bridges: string;
  domainFlags: string;
  confirmedStream: string;
  confirmedBy: string;
  confirmedAt: string;
  planBuiltAt: string | null;
  hasPlacement: boolean;
  fullyMarked: boolean;
};

export type SampleInProgressPlacementRow = {
  attemptId: string;
  userId: string;
  personName: string;
  department: string;
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
        .select("id, full_name, email, is_test_account, departments ( name, code )")
        .in("id", userIds)
        .eq("is_test_account", false)
    : { data: [] };
  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

  const attemptIds = (attempts ?? []).map((a) => a.id);
  const { data: results } = attemptIds.length
    ? await supabase.from("placement_results").select("*").in("attempt_id", attemptIds)
    : { data: [] };

  const resultByAttempt = new Map((results ?? []).map((r) => [r.attempt_id, r]));

  const confirmerIds = [
    ...new Set((results ?? []).map((r) => r.confirmed_by).filter(Boolean)),
  ] as string[];
  const { data: confirmers } = confirmerIds.length
    ? await supabase.from("profiles").select("id, full_name, email").in("id", confirmerIds)
    : { data: [] };
  const confirmerById = new Map((confirmers ?? []).map((p) => [p.id, p]));

  const confirmedUserIds = (results ?? [])
    .filter((r) => r.confirmed_at)
    .map((r) => r.user_id);
  const { data: planRows } = confirmedUserIds.length
    ? await supabase
        .from("learner_plan")
        .select("user_id, created_at")
        .in("user_id", confirmedUserIds)
        .order("created_at", { ascending: true })
    : { data: [] };
  const planBuiltByUser = new Map<string, string>();
  for (const row of planRows ?? []) {
    if (!planBuiltByUser.has(row.user_id)) {
      planBuiltByUser.set(row.user_id, row.created_at);
    }
  }

  return (attempts ?? [])
    .filter((attempt) => profileById.has(attempt.user_id))
    .map((attempt) => {
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
    const confirmer = pr?.confirmed_by ? confirmerById.get(pr.confirmed_by) : null;
    const score = (code: string) =>
      sectionScores?.[code] !== undefined ? String(sectionScores[code]) : "—";
    return {
      attemptId: attempt.id,
      userId: attempt.user_id,
      personName: profile?.full_name?.trim() || profile?.email || "—",
      department: deptRow?.name ?? deptRow?.code ?? "—",
      submittedAt: attempt.submitted_at ?? "",
      status: attempt.status,
      markingProgress: attempt.status === "marking" ? "In progress" : attempt.status === "marked" || attempt.status === "confirmed" ? "Complete" : "—",
      sectionScores: sectionText,
      scoreKnowledge: score("knowledge"),
      scorePrompting: score("prompting"),
      scoreDepartment: score("department"),
      scoreSafety: score("safety"),
      scoreWorkflow: score("workflow"),
      total: pr ? String(pr.total) : "—",
      technical,
      suggestedBand: pr?.suggested_band ?? "—",
      suggestedStream: pr?.suggested_stream ? streamLabel(pr.suggested_stream) : "—",
      gates: pr?.gates_failed?.length ? pr.gates_failed.join(", ") : "—",
      bridges: pr?.bridges?.length ? pr.bridges.join(", ") : "—",
      domainFlags: pr?.required_domain_flags?.length ? pr.required_domain_flags.join(", ") : "—",
      confirmedStream: pr?.confirmed_stream ? streamLabel(pr.confirmed_stream) : "—",
      confirmedBy: confirmer?.full_name?.trim() || confirmer?.email || "—",
      confirmedAt: pr?.confirmed_at ?? "",
      planBuiltAt: pr?.confirmed_at ? planBuiltByUser.get(attempt.user_id) ?? null : null,
      hasPlacement: Boolean(pr),
      fullyMarked: attempt.status === "marked" || attempt.status === "confirmed",
    };
  });
}

export async function loadSampleInProgressPlacementRows(): Promise<SampleInProgressPlacementRow[]> {
  const supabase = await createClient();
  const { data: assessment } = await supabase
    .from("assessments")
    .select("id")
    .eq("type", "placement")
    .eq("is_sample", true)
    .eq("status", "published")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!assessment) {
    return [];
  }
  const { data: attempts } = await supabase
    .from("attempts")
    .select("id, user_id")
    .eq("assessment_id", assessment.id)
    .eq("status", "in_progress");
  const userIds = [...new Set((attempts ?? []).map((row) => row.user_id))];
  const { data: profiles } = userIds.length
    ? await supabase
        .from("profiles")
        .select("id, full_name, email, departments ( name, code )")
        .in("id", userIds)
    : { data: [] };
  const profileById = new Map((profiles ?? []).map((row) => [row.id, row]));
  return (attempts ?? [])
    .filter((attempt) => profileById.has(attempt.user_id))
    .map((attempt) => {
      const profile = profileById.get(attempt.user_id)!;
      const dept = profile.departments as { name: string; code: string } | null;
      return {
        attemptId: attempt.id,
        userId: attempt.user_id,
        personName: profile.full_name?.trim() || profile.email,
        department: dept?.name ?? dept?.code ?? "—",
      };
    });
}

export type QuizResultsRow = {
  userId: string;
  personName: string;
  email: string;
  department: string;
  assessmentCode: string;
  assessmentTitle: string;
  quizType: string;
  passMarkPct: string;
  maxAttempts: string;
  attemptsUsed: string;
  bestPercentage: string;
  passed: string;
  outcomeLabel: string;
  firstPassAt: string;
  lastAttemptAt: string;
};

export async function loadQuizResultsRows(): Promise<QuizResultsRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_quiz_results_summary");
  if (error || !data) {
    return [];
  }

  const assessmentIds = [...new Set(data.map((row) => row.assessment_id))];
  const { data: assessments } = assessmentIds.length
    ? await supabase
        .from("assessments")
        .select("id, items_per_attempt")
        .in("id", assessmentIds)
    : { data: [] };
  const itemsPerAttemptById = new Map(
    (assessments ?? []).map((row) => [row.id, row.items_per_attempt]),
  );

  const { data: itemCounts } = assessmentIds.length
    ? await supabase.from("assessment_items").select("assessment_id").in("assessment_id", assessmentIds)
    : { data: [] };
  const countByAssessment = new Map<string, number>();
  for (const item of itemCounts ?? []) {
    countByAssessment.set(item.assessment_id, (countByAssessment.get(item.assessment_id) ?? 0) + 1);
  }

  return data.map((row) => {
    const poolSize = countByAssessment.get(row.assessment_id) ?? 0;
    const drawSize = itemsPerAttemptById.get(row.assessment_id) ?? poolSize;
    const itemCount = drawSize > 0 ? drawSize : poolSize;
    const pct = row.best_percentage ?? 0;
    const correct = correctCountFromPercentage(pct, itemCount);
    const outcomeLabel =
      row.best_percentage !== null && itemCount > 0
        ? formatQuizOutcomeLabel(correct, itemCount, pct, row.pass_mark_pct)
        : "—";
    const passedForFilter = quizHasPassMark(row.pass_mark_pct)
      ? row.passed
        ? "Yes"
        : "No"
      : row.attempts_used > 0
        ? "Yes"
        : "No";

    return {
      userId: row.user_id,
      personName: row.full_name?.trim() || row.email,
      email: row.email,
      department: row.department_code ?? "—",
      assessmentCode: row.assessment_code,
      assessmentTitle: row.assessment_title,
      quizType: row.assessment_type,
      passMarkPct: row.pass_mark_pct !== null ? `${row.pass_mark_pct}%` : "—",
      maxAttempts: row.max_attempts !== null ? String(row.max_attempts) : "Unlimited",
      attemptsUsed: String(row.attempts_used),
      bestPercentage: row.best_percentage !== null ? `${row.best_percentage}%` : "—",
      passed: passedForFilter,
      outcomeLabel,
      firstPassAt: row.first_pass_at ? formatDateTime(row.first_pass_at) : "—",
      lastAttemptAt: row.last_attempt_at ? formatDateTime(row.last_attempt_at) : "—",
    };
  });
}

export type QuizQuestionCheckRow = {
  itemRef: string;
  prompt: string;
  answeredCount: string;
  optionBreakdown: string;
};

export async function loadQuizQuestionCheck(assessmentId: string): Promise<QuizQuestionCheckRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_quiz_question_stats", {
    p_assessment_id: assessmentId,
  });
  if (error || !data) {
    return [];
  }
  return data.map((row) => {
    const counts = row.option_counts as Record<string, number> | null;
    const breakdown = counts
      ? Object.entries(counts)
          .map(([id, count]) => `${id}: ${count}`)
          .join("; ")
      : "—";
    return {
      itemRef: row.item_ref,
      prompt: markdownSnippet(row.prompt_md, 120),
      answeredCount: String(row.answered_count),
      optionBreakdown: breakdown,
    };
  });
}

export async function loadPublishedQuizzesForLearner(userId: string): Promise<ModuleQuizCard[]> {
  const supabase = await createClient();
  const { data: quizzes } = await supabase
    .from("assessments")
    .select("id, code, title, type, pass_mark_pct, max_attempts, items_per_attempt, modules ( code )")
    .eq("status", "published")
    .in("type", ["quiz", "safety_quiz"])
    .order("code");

  if (!quizzes?.length) {
    return [];
  }

  const ids = quizzes.map((q) => q.id);
  const { data: itemRows } = await supabase.from("assessment_items").select("assessment_id").in("assessment_id", ids);
  const itemCountByAssessment = new Map<string, number>();
  for (const item of itemRows ?? []) {
    itemCountByAssessment.set(item.assessment_id, (itemCountByAssessment.get(item.assessment_id) ?? 0) + 1);
  }

  const { data: attempts } = await supabase
    .from("attempts")
    .select("id, assessment_id, status, percentage, passed, submitted_at")
    .eq("user_id", userId)
    .in("assessment_id", ids);

  const attemptsByAssessment = new Map<string, typeof attempts>();
  for (const attempt of attempts ?? []) {
    const list = attemptsByAssessment.get(attempt.assessment_id) ?? [];
    list.push(attempt);
    attemptsByAssessment.set(attempt.assessment_id, list);
  }

  return quizzes.map((quiz) => {
    const moduleRow = quiz.modules as { code: string } | null;
    const list = attemptsByAssessment.get(quiz.id) ?? [];
    const inProgress = list.find((a) => a.status === "in_progress");
    const completed = list.filter((a) => a.status !== "in_progress");
    const completedCount = countCompletedAttempts(completed);
    const remaining = attemptsRemaining(quiz.max_attempts, completedCount);
    const best = pickBestQuizAttempt(
      completed.map(
        (a): QuizAttemptOutcome => ({
          percentage: a.percentage,
          passed: a.passed,
          submittedAt: a.submitted_at,
        }),
      ),
    );
    const poolSize = itemCountByAssessment.get(quiz.id) ?? 0;
    const itemCount = quiz.items_per_attempt ?? poolSize;
    const statusLabel = formatQuizLearnerStatusLabel({
      passMarkPct: quiz.pass_mark_pct,
      inProgress: Boolean(inProgress),
      best,
      remaining,
      itemCount: itemCount > 0 ? itemCount : poolSize,
    });

    const canStart =
      Boolean(inProgress) ||
      remaining === null ||
      (remaining !== null && remaining > 0);

    return {
      code: quiz.code,
      title: quiz.title,
      assessmentId: quiz.id,
      moduleCode: moduleRow?.code ?? "—",
      type: quiz.type as "quiz" | "safety_quiz",
      passMarkPct: quiz.pass_mark_pct,
      statusLabel,
      href: `/assessments/${quiz.code}`,
      canStart,
    };
  });
}

export async function loadModuleQuizForModule(
  userId: string,
  moduleId: string,
): Promise<ModuleQuizCard | null> {
  const cards = await loadPublishedQuizzesForLearner(userId);
  const supabase = await createClient();
  const { data: moduleRow } = await supabase.from("modules").select("code").eq("id", moduleId).maybeSingle();
  if (!moduleRow) {
    return null;
  }
  return cards.find((c) => c.moduleCode.toLowerCase() === moduleRow.code.toLowerCase()) ?? null;
}
