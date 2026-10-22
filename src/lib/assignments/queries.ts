import "server-only";

import { dueDateForProgrammeWeek } from "@/lib/calendar/programme-week";
import type { CohortBreak } from "@/lib/calendar/types";
import { authorise } from "@/lib/auth";
import {
  deriveLearnerAssignmentStatus,
  formatReleasedMark,
  learnerAssignmentStatusLabel,
  type LearnerAssignmentStatus,
} from "@/lib/assignments/status-labels";
import {
  differenceRequiresFinalReview,
  markPercentage,
  selectReleasedReviewTotal,
} from "@/lib/assignments/validators";
import { workingDaysWaiting } from "@/lib/assignments/working-days";
import type { PlanStatus } from "@/lib/plan/types";
import { createAssignmentsClient } from "@/lib/supabase/assignments-client";
import type { ReviewKind, SubmissionStatus } from "@/lib/types/database-assignments";

const planStatusesWithAssignments: PlanStatus[] = ["required", "test_out_pending", "bridge"];

export type LearnerAssignmentListRow = {
  id: string;
  moduleCode: string;
  moduleTitle: string;
  title: string;
  dueLabel: string | null;
  status: LearnerAssignmentStatus;
  statusLabel: string;
  markLabel: string | null;
  href: string;
  sortStage: number;
  sortModule: number;
};

export type RubricCriterionView = {
  id: string;
  name: string;
  maxScore: number;
  levels: { score: number; descriptor: string }[];
};

export type LearnerSubmissionView = {
  id: string;
  attemptNo: number;
  status: SubmissionStatus;
  submittedAt: string;
  linkUrl: string | null;
  filePath: string | null;
  textMd: string | null;
  releasedTotal: number | null;
  releasedMax: number | null;
  releasedPct: number | null;
  feedbackMd: string | null;
  markerName: string | null;
  releasedAt: string | null;
  criterionLevels: { name: string; score: number; descriptor: string }[];
};

export type LearnerAssignmentDetail = {
  id: string;
  code: string;
  title: string;
  briefMd: string;
  submissionTypes: string[];
  passMarkPct: number;
  moduleCode: string;
  moduleTitle: string;
  criteria: RubricCriterionView[];
  maxTotal: number;
  canSubmit: boolean;
  latestSubmission: LearnerSubmissionView | null;
  history: LearnerSubmissionView[];
};

export type MarkingQueueRow = {
  submissionId: string;
  userId: string;
  personLabel: string;
  personName: string;
  department: string;
  moduleCode: string;
  assignmentTitle: string;
  assignmentCode: string;
  attemptNo: number;
  submittedAt: string;
  workingDays: number;
  status: SubmissionStatus;
  statusLabel: string;
  doubleMarkPending: boolean;
  assignmentId: string;
};

export type ModerationRow = {
  submissionId: string;
  personName: string;
  department: string;
  moduleCode: string;
  assignmentTitle: string;
  attemptNo: number;
  primaryTotal: number | null;
  doubleTotal: number | null;
  maxTotal: number;
  differencePct: number | null;
  finalRequired: boolean;
  finalTotal: number | null;
  released: boolean;
  assignmentId: string;
};

export type TrainerAssignmentListRow = {
  id: string;
  code: string;
  title: string;
  statusLabel: string;
  version: number;
  isSample: boolean;
  moduleCode: string;
  passMarkPct: string;
  submissionTypes: string;
  departmentCode: string;
  isTestOut: boolean;
};

async function loadLearnerContext(userId: string) {
  const supabase = await createAssignmentsClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("department_id, cohort_id, cohorts ( week0_start_date )")
    .eq("id", userId)
    .maybeSingle();

  const cohort = profile?.cohorts as { week0_start_date: string | null } | null;
  const week0 = cohort?.week0_start_date ?? null;
  let breaks: CohortBreak[] = [];
  if (profile?.cohort_id) {
    const { data: breakRows } = await supabase
      .from("cohort_breaks")
      .select("start_date, weeks, label")
      .eq("cohort_id", profile.cohort_id);
    breaks = (breakRows ?? []).map((row) => ({
      startDate: row.start_date,
      weeks: row.weeks,
      label: row.label,
    }));
  }

  const { data: plan } = await supabase
    .from("learner_plan")
    .select("module_id, status, due_week")
    .eq("user_id", userId);

  const { data: modules } = await supabase.from("modules").select("id, code, title, sort_order, stage_id");
  const { data: stages } = await supabase.from("stages").select("id, sort_order");
  const stageSort = new Map((stages ?? []).map((s) => [s.id, s.sort_order]));

  const moduleMeta = new Map(
    (modules ?? []).map((row) => [
      row.id,
      {
        code: row.code,
        title: row.title,
        stageSort: stageSort.get(row.stage_id) ?? 0,
        moduleSort: row.sort_order ?? 0,
      },
    ]),
  );

  const planByModule = new Map(
    (plan ?? []).map((row) => [
      row.module_id,
      { status: row.status as PlanStatus, dueWeek: row.due_week as number | null },
    ]),
  );

  return {
    supabase,
    departmentId: profile?.department_id ?? null,
    week0,
    breaks,
    planByModule,
    moduleMeta,
  };
}

function assignmentVisibleOnPlan(
  departmentId: string | null,
  assignmentDepartmentId: string | null,
  planStatus: PlanStatus | undefined,
): boolean {
  if (!planStatus || !planStatusesWithAssignments.includes(planStatus)) {
    return false;
  }
  if (assignmentDepartmentId === null) {
    return true;
  }
  return departmentId !== null && assignmentDepartmentId === departmentId;
}

export async function listLearnerAssignments(userId: string): Promise<LearnerAssignmentListRow[]> {
  const ctx = await loadLearnerContext(userId);
  const moduleIds = [...ctx.planByModule.keys()];
  if (moduleIds.length === 0) {
    return [];
  }

  const { data: assignments } = await ctx.supabase
    .from("assignments")
    .select("id, code, title, module_id, department_id, pass_mark_pct")
    .eq("status", "published")
    .in("module_id", moduleIds);

  const visible = (assignments ?? []).filter((row) => {
    const plan = ctx.planByModule.get(row.module_id);
    return assignmentVisibleOnPlan(ctx.departmentId, row.department_id, plan?.status);
  });

  if (visible.length === 0) {
    return [];
  }

  const assignmentIds = visible.map((row) => row.id);
  const { data: submissions } = await ctx.supabase
    .from("submissions")
    .select("id, assignment_id, status, attempt_no, submitted_at")
    .eq("user_id", userId)
    .in("assignment_id", assignmentIds)
    .order("attempt_no", { ascending: false });

  type SubmissionSummary = {
    id: string;
    assignment_id: string;
    status: SubmissionStatus;
    attempt_no: number;
    submitted_at: string;
  };
  const latestByAssignment = new Map<string, SubmissionSummary>();
  for (const sub of submissions ?? []) {
    if (!latestByAssignment.has(sub.assignment_id)) {
      latestByAssignment.set(sub.assignment_id, { ...sub, status: sub.status as SubmissionStatus });
    }
  }

  const releasedIds = (submissions ?? [])
    .filter((sub) => sub.status === "returned")
    .map((sub) => sub.id);
  const releasedMarks = new Map<string, { total: number; max: number }>();
  if (releasedIds.length > 0) {
    const { data: reviews } = await ctx.supabase
      .from("reviews")
      .select("submission_id, kind, total, max_total, released_at")
      .in("submission_id", releasedIds)
      .not("released_at", "is", null);
    for (const subId of releasedIds) {
      const forSub = (reviews ?? []).filter((r) => r.submission_id === subId);
      const total = selectReleasedReviewTotal(
        forSub.map((r) => ({ kind: r.kind as ReviewKind, total: Number(r.total) })),
      );
      const max = forSub[0]?.max_total ?? 0;
      if (total !== null) {
        releasedMarks.set(subId, { total, max: Number(max) });
      }
    }
  }

  const rows: LearnerAssignmentListRow[] = [];
  for (const row of visible) {
    const plan = ctx.planByModule.get(row.module_id);
    const meta = ctx.moduleMeta.get(row.module_id);
    const latest = latestByAssignment.get(row.id);
    const learnerStatus = deriveLearnerAssignmentStatus(
      (latest?.status as SubmissionStatus | undefined) ?? null,
    );
    const dueLabel =
      plan?.dueWeek && ctx.week0
        ? `Fri ${dueDateForProgrammeWeek(plan.dueWeek, ctx.week0, ctx.breaks)}`
        : null;
    const mark = latest && releasedMarks.has(latest.id)
      ? formatReleasedMark(releasedMarks.get(latest.id)!.total, releasedMarks.get(latest.id)!.max)
      : null;

    rows.push({
      id: row.id,
      moduleCode: meta?.code ?? "—",
      moduleTitle: meta?.title ?? "",
      title: row.title,
      dueLabel,
      status: learnerStatus,
      statusLabel: learnerAssignmentStatusLabel(learnerStatus),
      markLabel: mark,
      href: `/assignments/${row.id}`,
      sortStage: meta?.stageSort ?? 0,
      sortModule: meta?.moduleSort ?? 0,
    });
  }

  rows.sort((a, b) => a.sortStage - b.sortStage || a.sortModule - b.sortModule || a.title.localeCompare(b.title));
  return rows;
}

async function loadRubricCriteria(
  supabase: Awaited<ReturnType<typeof createAssignmentsClient>>,
  rubricId: string,
): Promise<RubricCriterionView[]> {
  const { data: critRows } = await supabase
    .from("rubric_criteria")
    .select("id, name, max_score, sort_order")
    .eq("rubric_id", rubricId)
    .order("sort_order");
  const criteria: RubricCriterionView[] = [];
  for (const crit of critRows ?? []) {
    const { data: levels } = await supabase
      .from("rubric_levels")
      .select("score, descriptor")
      .eq("criterion_id", crit.id)
      .order("score");
    criteria.push({
      id: crit.id,
      name: crit.name,
      maxScore: crit.max_score,
      levels: levels ?? [],
    });
  }
  return criteria;
}

async function mapSubmissionView(
  supabase: Awaited<ReturnType<typeof createAssignmentsClient>>,
  submission: {
    id: string;
    attempt_no: number;
    status: SubmissionStatus;
    submitted_at: string;
    link_url: string | null;
    file_path: string | null;
    text_md: string | null;
  },
  criteria: RubricCriterionView[],
): Promise<LearnerSubmissionView> {
  const { data: reviews } = await supabase
    .from("reviews")
    .select("kind, total, max_total, feedback_md, released_at, reviewer_id, criterion_scores")
    .eq("submission_id", submission.id)
    .not("released_at", "is", null);

  const released = (reviews ?? []).filter((r) => r.released_at);
  const winningTotal = selectReleasedReviewTotal(
    released.map((r) => ({ kind: r.kind as ReviewKind, total: Number(r.total) })),
  );
  const winningReview =
    released.find((r) => r.kind === "final") ??
    released.find((r) => r.kind === "primary") ??
    null;

  let markerName: string | null = null;
  if (winningReview?.reviewer_id) {
    const { data: marker } = await supabase
      .from("profiles")
      .select("full_name, email")
      .eq("id", winningReview.reviewer_id)
      .maybeSingle();
    markerName = marker?.full_name?.trim() || marker?.email || null;
  }

  const scores = (winningReview?.criterion_scores ?? {}) as Record<string, number>;
  const criterionLevels = criteria.map((crit) => {
    const score = scores[crit.id] ?? 0;
    const level = crit.levels.find((l) => l.score === score);
    return { name: crit.name, score, descriptor: level?.descriptor ?? "—" };
  });

  const maxTotal = winningReview ? Number(winningReview.max_total) : null;

  return {
    id: submission.id,
    attemptNo: submission.attempt_no,
    status: submission.status,
    submittedAt: submission.submitted_at,
    linkUrl: submission.link_url,
    filePath: submission.file_path,
    textMd: submission.text_md,
    releasedTotal: winningTotal,
    releasedMax: maxTotal,
    releasedPct:
      winningTotal !== null && maxTotal
        ? Math.round(markPercentage(winningTotal, maxTotal))
        : null,
    feedbackMd: winningReview?.feedback_md ?? null,
    markerName,
    releasedAt: winningReview?.released_at ?? null,
    criterionLevels,
  };
}

export async function getLearnerAssignmentDetail(
  userId: string,
  assignmentId: string,
): Promise<LearnerAssignmentDetail | null> {
  const ctx = await loadLearnerContext(userId);
  const { data: assignment } = await ctx.supabase
    .from("assignments")
    .select("id, code, title, brief_md, submission_types, pass_mark_pct, module_id, department_id, rubric_id")
    .eq("id", assignmentId)
    .eq("status", "published")
    .maybeSingle();

  if (!assignment) {
    return null;
  }

  const plan = ctx.planByModule.get(assignment.module_id);
  if (!assignmentVisibleOnPlan(ctx.departmentId, assignment.department_id, plan?.status)) {
    return null;
  }

  const criteria = await loadRubricCriteria(ctx.supabase, assignment.rubric_id);
  const maxTotal = criteria.reduce((sum, c) => sum + c.maxScore, 0);

  const { data: submissions } = await ctx.supabase
    .from("submissions")
    .select("id, attempt_no, status, submitted_at, link_url, file_path, text_md")
    .eq("assignment_id", assignmentId)
    .eq("user_id", userId)
    .order("attempt_no", { ascending: false });

  const history: LearnerSubmissionView[] = [];
  for (const sub of submissions ?? []) {
    history.push(
      await mapSubmissionView(ctx.supabase, { ...sub, status: sub.status as SubmissionStatus }, criteria),
    );
  }
  const latest = history[0] ?? null;
  const canSubmit =
    !latest || latest.status === "resubmit_requested" || latest.status === "withdrawn";

  const moduleMeta = ctx.moduleMeta.get(assignment.module_id);

  return {
    id: assignment.id,
    code: assignment.code,
    title: assignment.title,
    briefMd: assignment.brief_md,
    submissionTypes: assignment.submission_types,
    passMarkPct: assignment.pass_mark_pct,
    moduleCode: moduleMeta?.code ?? "",
    moduleTitle: moduleMeta?.title ?? "",
    criteria,
    maxTotal,
    canSubmit,
    latestSubmission: latest,
    history,
  };
}

function submissionStatusLabel(status: SubmissionStatus): string {
  switch (status) {
    case "submitted":
      return "Submitted";
    case "in_review":
      return "In review";
    case "returned":
      return "Returned";
    case "resubmit_requested":
      return "Resubmit requested";
    case "withdrawn":
      return "Withdrawn";
    default:
      return status;
  }
}

export async function listMarkingQueue(hideNames: boolean): Promise<MarkingQueueRow[]> {
  const user = await authorise(["trainer", "admin", "champion"]);
  if (!user) {
    return [];
  }
  const supabase = await createAssignmentsClient();
  const isChampionOnly = user.role === "champion";

  let filterIds: string[] | null = null;
  if (isChampionOnly) {
    const { data: assigned } = await supabase
      .from("review_assignments")
      .select("submission_id")
      .eq("reviewer_id", user.id)
      .eq("kind", "double_mark")
      .is("completed_at", null);
    filterIds = (assigned ?? []).map((row) => row.submission_id);
    if (filterIds.length === 0) {
      return [];
    }
  }

  let submissionQuery = supabase
    .from("submissions")
    .select("id, user_id, assignment_id, attempt_no, status, submitted_at")
    .in("status", ["submitted", "in_review", "resubmit_requested"])
    .order("submitted_at", { ascending: true });
  if (filterIds) {
    submissionQuery = submissionQuery.in("id", filterIds);
  }

  const { data: rows } = await submissionQuery;
  if (!rows?.length) {
    return [];
  }

  const userIds = [...new Set(rows.map((row) => row.user_id))];
  const assignmentIds = [...new Set(rows.map((row) => row.assignment_id))];
  const [{ data: profiles }, { data: assignmentRows }, { data: modules }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, email, department_id").in("id", userIds),
    supabase.from("assignments").select("id, code, title, module_id").in("id", assignmentIds),
    supabase.from("modules").select("id, code"),
  ]);
  const { data: departments } = await supabase.from("departments").select("id, name");
  const deptName = new Map((departments ?? []).map((d) => [d.id, d.name]));
  const profileById = new Map(
    (profiles ?? []).map((p) => [
      p.id,
      {
        name: p.full_name?.trim() || p.email,
        department: p.department_id ? deptName.get(p.department_id) ?? "—" : "—",
      },
    ]),
  );
  const moduleCode = new Map((modules ?? []).map((m) => [m.id, m.code]));
  const assignmentById = new Map(
    (assignmentRows ?? []).map((a) => [
      a.id,
      {
        code: a.code,
        title: a.title,
        moduleCode: moduleCode.get(a.module_id) ?? "—",
      },
    ]),
  );

  const submissionIds = rows.map((row) => row.id);
  const { data: pendingDm } = await supabase
    .from("review_assignments")
    .select("submission_id")
    .in("submission_id", submissionIds)
    .eq("kind", "double_mark")
    .is("completed_at", null);

  const pendingSet = new Set((pendingDm ?? []).map((row) => row.submission_id));

  return rows.map((row, index) => {
    const profile = profileById.get(row.user_id);
    const assignment = assignmentById.get(row.assignment_id);
    const personName = profile?.name ?? "Learner";
    return {
      submissionId: row.id,
      userId: row.user_id,
      personLabel: hideNames ? `Person ${index + 1}` : personName,
      personName,
      department: profile?.department ?? "—",
      moduleCode: assignment?.moduleCode ?? "—",
      assignmentTitle: assignment?.title ?? "",
      assignmentCode: assignment?.code ?? "",
      attemptNo: row.attempt_no,
      submittedAt: row.submitted_at,
      workingDays: workingDaysWaiting(new Date(row.submitted_at)),
      status: row.status as SubmissionStatus,
      statusLabel: submissionStatusLabel(row.status as SubmissionStatus),
      doubleMarkPending: pendingSet.has(row.id),
      assignmentId: row.assignment_id,
    };
  });
}

export async function listModerationQueue(): Promise<ModerationRow[]> {
  if (!(await authorise(["trainer", "admin"]))) {
    return [];
  }
  const supabase = await createAssignmentsClient();
  const { data: setting } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "marking.difference_threshold_pct")
    .maybeSingle();
  const threshold =
    typeof setting?.value === "number"
      ? setting.value
      : Number((setting?.value as { toString?: () => string }) ?? 15);

  const { data: subs } = await supabase
    .from("submissions")
    .select("id, assignment_id, attempt_no, status, user_id")
    .in("status", ["submitted", "in_review", "returned"]);

  const userIds = [...new Set((subs ?? []).map((s) => s.user_id))];
  const assignmentIds = [...new Set((subs ?? []).map((s) => s.assignment_id))];
  const [{ data: profiles }, { data: assignmentRows }, { data: modules }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, email, department_id").in("id", userIds),
    supabase.from("assignments").select("id, title, module_id").in("id", assignmentIds),
    supabase.from("modules").select("id, code"),
  ]);
  const { data: departments } = await supabase.from("departments").select("id, name");
  const deptName = new Map((departments ?? []).map((d) => [d.id, d.name]));
  const profileById = new Map(
    (profiles ?? []).map((p) => [
      p.id,
      {
        name: p.full_name?.trim() || p.email,
        department: p.department_id ? deptName.get(p.department_id) ?? "—" : "—",
      },
    ]),
  );
  const moduleCode = new Map((modules ?? []).map((m) => [m.id, m.code]));
  const assignmentById = new Map(
    (assignmentRows ?? []).map((a) => [
      a.id,
      { title: a.title, moduleCode: moduleCode.get(a.module_id) ?? "—" },
    ]),
  );

  const rows: ModerationRow[] = [];
  for (const sub of subs ?? []) {
    const { data: reviews } = await supabase
      .from("reviews")
      .select("kind, total, max_total, released_at")
      .eq("submission_id", sub.id);
    const primary = reviews?.find((r) => r.kind === "primary");
    const double = reviews?.find((r) => r.kind === "double_mark");
    const finalReview = reviews?.find((r) => r.kind === "final");
    if (!primary) {
      continue;
    }
    const maxTotal = Number(primary.max_total);
    const primaryTotal = Number(primary.total);
    const doubleTotal = double ? Number(double.total) : null;
    const diffPct =
      doubleTotal !== null && maxTotal > 0
        ? Math.round((Math.abs(primaryTotal - doubleTotal) / maxTotal) * 100)
        : null;
    const finalRequired =
      doubleTotal !== null &&
      differenceRequiresFinalReview(primaryTotal, doubleTotal, maxTotal, threshold);
    const profile = profileById.get(sub.user_id);
    const assignment = assignmentById.get(sub.assignment_id);
    rows.push({
      submissionId: sub.id,
      personName: profile?.name ?? "Learner",
      department: profile?.department ?? "—",
      moduleCode: assignment?.moduleCode ?? "—",
      assignmentTitle: assignment?.title ?? "",
      attemptNo: sub.attempt_no,
      primaryTotal,
      doubleTotal,
      maxTotal,
      differencePct: diffPct,
      finalRequired,
      finalTotal: finalReview ? Number(finalReview.total) : null,
      released: sub.status === "returned",
      assignmentId: sub.assignment_id,
    });
  }
  return rows;
}

export async function loadTrainerAssignments(): Promise<TrainerAssignmentListRow[]> {
  if (!(await authorise(["trainer", "admin"]))) {
    return [];
  }
  const supabase = await createAssignmentsClient();
  const { data: rows } = await supabase
    .from("assignments")
    .select(
      "id, code, title, status, version, is_sample, pass_mark_pct, submission_types, is_test_out, module_id, department_id",
    )
    .order("code")
    .order("version", { ascending: false });
  const { data: modules } = await supabase.from("modules").select("id, code");
  const { data: departments } = await supabase.from("departments").select("id, code");
  const moduleCodeById = new Map((modules ?? []).map((m) => [m.id, m.code]));
  const deptCodeById = new Map((departments ?? []).map((d) => [d.id, d.code]));

  const statusLabels: Record<string, string> = {
    draft: "Draft",
    published: "Published",
    archived: "Archived",
  };

  return (rows ?? []).map((row) => {
    return {
      id: row.id,
      code: row.code,
      title: row.title,
      statusLabel: statusLabels[row.status] ?? row.status,
      version: row.version,
      isSample: row.is_sample,
      moduleCode: moduleCodeById.get(row.module_id) ?? "—",
      passMarkPct: `${row.pass_mark_pct}%`,
      submissionTypes: (row.submission_types ?? []).join(", "),
      departmentCode: row.department_id ? deptCodeById.get(row.department_id) ?? "—" : "All",
      isTestOut: row.is_test_out,
    };
  });
}

export async function findPublishedAssignmentByCode(code: string): Promise<string | null> {
  const supabase = await createAssignmentsClient();
  const { data } = await supabase
    .from("assignments")
    .select("id")
    .eq("code", code)
    .eq("status", "published")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}
