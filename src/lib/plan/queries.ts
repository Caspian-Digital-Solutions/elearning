import "server-only";

import {
  dueDateForProgrammeWeek,
  formatProgrammeWeekLine,
  programmeWeekForDate,
  weekDateRange,
} from "@/lib/calendar/programme-week";
import type { CohortBreak } from "@/lib/calendar/types";
import { buildCohortCalendarPreview, type CohortCalendarWeekRow } from "@/lib/calendar/cohort-preview";
import { pickBestQuizAttempt, quizPassed } from "@/lib/assessments/quiz-status";
import { formatCalendarDate, formatDateTime } from "@/lib/format";
import { streamNames, type Stream } from "@/lib/people/labels";
import {
  isModuleComplete,
  moduleQuizOutcomeLabel,
  type ModuleQuizState,
  type PublishedLesson,
} from "@/lib/plan/module-complete";
import type { PlanStatus } from "@/lib/plan/types";
import { createClient } from "@/lib/supabase/server";

export type PlanModuleRow = {
  moduleId: string;
  code: string;
  title: string;
  status: PlanStatus;
  dueWeek: number | null;
  dueDateLabel: string | null;
  weekStart: number | null;
  weekEnd: number | null;
  lessonsDone: number;
  lessonsTotal: number;
  quizLabel: string | null;
  done: boolean;
  completedAt: string | null;
  reason: string | null;
  overrideReason: string | null;
  isOverride: boolean;
  setByName: string | null;
  href: string;
};

export type MyPathPlanView = {
  streamLabel: string;
  cohortName: string | null;
  programmeWeekLine: string;
  programmeWeek: number | null;
  requiredDone: number;
  requiredTotal: number;
  thisWeek: PlanModuleRow[];
  bridges: PlanModuleRow[];
  comingUp: PlanModuleRow[];
  overdue: PlanModuleRow[];
  maySkip: PlanModuleRow[];
  done: PlanModuleRow[];
  optional: PlanModuleRow[];
};

export type MyPathState =
  | {
      kind: "no_week0";
      title: string;
      timeGuideMin: number | null;
      href: string;
    }
  | {
      kind: "awaiting_confirmation";
      submittedAtLabel: string;
    }
  | {
      kind: "plan_ready";
      plan: MyPathPlanView;
    };

export type TrainerPlanView = {
  userId: string;
  personName: string;
  stream: Stream | null;
  cohortName: string | null;
  week0StartDate: string | null;
  breaks: CohortBreak[];
  rows: PlanModuleRow[];
  hasPlan: boolean;
};

export type CohortBreakRecord = CohortBreak & { id: string; cohortId: string };

type ModuleMeta = {
  id: string;
  code: string;
  title: string;
  week_start: number | null;
  week_end: number | null;
};

function calendarContext(
  week0Start: string | null | undefined,
  breaks: readonly CohortBreak[],
): { breaks: CohortBreak[]; week0: string | null; todayWeek: number | null; weekLine: string } {
  if (!week0Start) {
    return { breaks: [...breaks], week0: null, todayWeek: null, weekLine: "" };
  }
  const state = programmeWeekForDate(new Date(), week0Start, breaks);
  const weekLine = formatProgrammeWeekLine(new Date(), week0Start, breaks);
  const todayWeek = state.kind === "week" ? state.programmeWeek : null;
  return { breaks: [...breaks], week0: week0Start, todayWeek, weekLine };
}

function dueLabel(dueWeek: number | null, week0: string | null, breaks: readonly CohortBreak[]): string | null {
  if (dueWeek === null || !week0) {
    return null;
  }
  const friday = dueDateForProgrammeWeek(dueWeek, week0, breaks);
  return friday ? `Due Fri ${friday}` : null;
}

async function loadModuleCatalog(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: modules } = await supabase
    .from("modules")
    .select("id, code, title, week_start, week_end")
    .order("code");
  return (modules ?? []) as ModuleMeta[];
}

async function loadProgressMaps(userId: string, supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: lessons } = await supabase.from("lessons").select("id, module_id, status");
  const { data: progress } = await supabase
    .from("lesson_progress")
    .select("lesson_id, completed_at")
    .eq("user_id", userId);

  const lessonsByModule = new Map<string, PublishedLesson[]>();
  for (const lesson of lessons ?? []) {
    const list = lessonsByModule.get(lesson.module_id) ?? [];
    list.push({ id: lesson.id, status: lesson.status });
    lessonsByModule.set(lesson.module_id, list);
  }

  const progressByLesson = new Map(
    (progress ?? []).map((row) => [row.lesson_id, row.completed_at as string]),
  );

  return { lessonsByModule, progressByLesson };
}

async function loadQuizStateByModule(
  userId: string,
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<Map<string, ModuleQuizState>> {
  const { data: quizzes } = await supabase
    .from("assessments")
    .select("id, module_id, pass_mark_pct, items_per_attempt, type")
    .eq("status", "published")
    .in("type", ["quiz", "safety_quiz"]);

  type QuizRow = NonNullable<typeof quizzes>[number];
  const quizByModule = new Map<string, QuizRow>();
  const moduleByAssessment = new Map<string, string>();
  for (const quiz of quizzes ?? []) {
    if (quiz.module_id) {
      quizByModule.set(quiz.module_id, quiz);
      moduleByAssessment.set(quiz.id, quiz.module_id);
    }
  }

  const assessmentIds = (quizzes ?? []).map((q) => q.id);
  const { data: attempts } = assessmentIds.length
    ? await supabase
        .from("attempts")
        .select("assessment_id, status, percentage, submitted_at")
        .eq("user_id", userId)
        .in("assessment_id", assessmentIds)
        .in("status", ["submitted", "marking", "marked", "confirmed"])
    : { data: [] };

  const { data: itemCounts } = assessmentIds.length
    ? await supabase.from("assessment_items").select("assessment_id").in("assessment_id", assessmentIds)
    : { data: [] };
  const countByAssessment = new Map<string, number>();
  for (const item of itemCounts ?? []) {
    countByAssessment.set(item.assessment_id, (countByAssessment.get(item.assessment_id) ?? 0) + 1);
  }

  const attemptsByModule = new Map<
    string,
    { percentage: number | null; submittedAt: string | null; passed: boolean | null }[]
  >();
  for (const attempt of attempts ?? []) {
    const moduleId = moduleByAssessment.get(attempt.assessment_id);
    if (!moduleId) {
      continue;
    }
    const quiz = quizByModule.get(moduleId);
    const list = attemptsByModule.get(moduleId) ?? [];
    const pct = attempt.percentage;
    const passMark = quiz?.pass_mark_pct;
    list.push({
      percentage: pct,
      submittedAt: attempt.submitted_at,
      passed:
        pct !== null && passMark !== null && passMark !== undefined && passMark > 0
          ? quizPassed(pct, passMark)
          : pct !== null
            ? true
            : null,
    });
    attemptsByModule.set(moduleId, list);
  }

  const result = new Map<string, ModuleQuizState>();
  for (const [moduleId, quiz] of quizByModule) {
    const pool = countByAssessment.get(quiz.id) ?? 0;
    const draw = quiz.items_per_attempt ?? pool;
    const questionCount = draw > 0 ? draw : pool;
    const list = attemptsByModule.get(moduleId) ?? [];
    const best = pickBestQuizAttempt(list);
    result.set(moduleId, {
      passMarkPct: quiz.pass_mark_pct,
      itemsPerAttempt: quiz.items_per_attempt,
      questionCount,
      bestPercentage: best?.percentage ?? null,
      hasSubmittedAttempt: list.length > 0,
    });
  }
  return result;
}

function buildPlanModuleRow(
  meta: ModuleMeta,
  planRow: {
    status: PlanStatus;
    due_week: number | null;
    reason: string | null;
    override_reason: string | null;
    is_override: boolean;
    set_by_name: string | null;
  },
  lessons: PublishedLesson[],
  progressByLesson: Map<string, string>,
  quiz: ModuleQuizState | null,
  week0: string | null,
  breaks: readonly CohortBreak[],
): PlanModuleRow {
  const progressRows = lessons
    .filter((lesson) => lesson.status === "published" && progressByLesson.has(lesson.id))
    .map((lesson) => ({ lessonId: lesson.id }));
  const publishedCount = lessons.filter((lesson) => lesson.status === "published").length;
  const done = isModuleComplete(lessons, progressRows, quiz);
  let completedAt: string | null = null;
  if (done && publishedCount > 0) {
    const times = lessons
      .filter((lesson) => lesson.status === "published")
      .map((lesson) => progressByLesson.get(lesson.id))
      .filter(Boolean) as string[];
    completedAt = times.sort().at(-1) ?? null;
  }

  return {
    moduleId: meta.id,
    code: meta.code,
    title: meta.title,
    status: planRow.status,
    dueWeek: planRow.due_week,
    dueDateLabel: dueLabel(planRow.due_week, week0, breaks),
    weekStart: meta.week_start,
    weekEnd: meta.week_end,
    lessonsDone: progressRows.length,
    lessonsTotal: publishedCount,
    quizLabel: quiz ? moduleQuizOutcomeLabel(quiz) : null,
    done,
    completedAt,
    reason: planRow.reason,
    overrideReason: planRow.override_reason,
    isOverride: planRow.is_override,
    setByName: planRow.set_by_name,
    href: `/lessons/${meta.code.toLowerCase()}`,
  };
}

async function loadPlanRowsForUser(
  userId: string,
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<
  {
    meta: ModuleMeta;
    plan: {
      status: PlanStatus;
      due_week: number | null;
      reason: string | null;
      override_reason: string | null;
      is_override: boolean;
      set_by_name: string | null;
    };
  }[]
> {
  const catalog = await loadModuleCatalog(supabase);
  const { data: plan } = await supabase
    .from("learner_plan")
    .select("module_id, status, due_week, reason, override_reason, is_override, set_by")
    .eq("user_id", userId);

  const setterIds = [...new Set((plan ?? []).map((row) => row.set_by).filter(Boolean))] as string[];
  const { data: setters } = setterIds.length
    ? await supabase.from("profiles").select("id, full_name, email").in("id", setterIds)
    : { data: [] };
  const setterName = new Map(
    (setters ?? []).map((row) => [row.id, row.full_name?.trim() || row.email]),
  );

  const planByModule = new Map(
    (plan ?? []).map((row) => [
      row.module_id,
      {
        status: row.status as PlanStatus,
        due_week: row.due_week as number | null,
        reason: row.reason,
        override_reason: row.override_reason,
        is_override: Boolean(row.is_override),
        set_by_name: row.set_by ? setterName.get(row.set_by) ?? null : null,
      },
    ]),
  );

  return catalog
    .filter((meta) => planByModule.has(meta.id))
    .map((meta) => ({ meta, plan: planByModule.get(meta.id)! }));
}

export async function loadCohortBreaksForCohort(cohortId: string): Promise<CohortBreakRecord[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("cohort_breaks")
    .select("id, cohort_id, start_date, weeks, label")
    .eq("cohort_id", cohortId)
    .order("start_date");
  return (data ?? []).map((row) => ({
    id: row.id,
    cohortId: row.cohort_id,
    startDate: row.start_date,
    weeks: row.weeks,
    label: row.label,
  }));
}

export async function loadCohortCalendarPreviewData(
  week0StartDate: string,
  breaks: readonly CohortBreak[],
): Promise<CohortCalendarWeekRow[]> {
  return buildCohortCalendarPreview(week0StartDate, breaks);
}

export async function loadMyPathState(userId: string): Promise<MyPathState> {
  const supabase = await createClient();

  const { data: placementAssessment } = await supabase
    .from("assessments")
    .select("id, code, title, time_guide_min, is_sample")
    .eq("type", "placement")
    .eq("status", "published")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!placementAssessment) {
    return {
      kind: "no_week0",
      title: "Week 0 assessment",
      timeGuideMin: null,
      href: "/assessments",
    };
  }

  const { data: attempts } = await supabase
    .from("attempts")
    .select("id, status, submitted_at")
    .eq("user_id", userId)
    .eq("assessment_id", placementAssessment.id)
    .order("created_at", { ascending: false });

  const latest = attempts?.[0];
  if (!latest || latest.status === "in_progress") {
    return {
      kind: "no_week0",
      title: placementAssessment.title,
      timeGuideMin: placementAssessment.time_guide_min,
      href: `/assessments/${placementAssessment.code}`,
    };
  }

  const { data: placementResult } = await supabase
    .from("placement_results")
    .select("confirmed_at")
    .eq("attempt_id", latest.id)
    .maybeSingle();

  if (!placementResult?.confirmed_at) {
    return {
      kind: "awaiting_confirmation",
      submittedAtLabel: latest.submitted_at ? formatDateTime(latest.submitted_at) : "—",
    };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("stream, cohort_id, cohorts ( name, week0_start_date )")
    .eq("id", userId)
    .maybeSingle();

  const cohort = profile?.cohorts as { name: string; week0_start_date: string | null } | null;
  const breaks =
    profile?.cohort_id ? await loadCohortBreaksForCohort(profile.cohort_id) : [];
  const breakRows: CohortBreak[] = breaks.map((row) => ({
    startDate: row.startDate,
    weeks: row.weeks,
    label: row.label,
  }));

  const { week0, todayWeek, weekLine } = calendarContext(cohort?.week0_start_date, breakRows);
  const joined = await loadPlanRowsForUser(userId, supabase);
  const { lessonsByModule, progressByLesson } = await loadProgressMaps(userId, supabase);
  const quizByModule = await loadQuizStateByModule(userId, supabase);

  const rows: PlanModuleRow[] = joined.map(({ meta, plan }) =>
    buildPlanModuleRow(
      meta,
      plan,
      lessonsByModule.get(meta.id) ?? [],
      progressByLesson,
      quizByModule.get(meta.id) ?? null,
      week0,
      breakRows,
    ),
  );

  const requiredStatuses = new Set<PlanStatus>(["required", "bridge"]);
  const requiredRows = rows.filter((row) => requiredStatuses.has(row.status));
  const requiredDone = requiredRows.filter((row) => row.done).length;

  const thisWeek =
    todayWeek === null
      ? []
      : rows.filter(
          (row) =>
            row.status !== "not_applicable" &&
            row.status !== "tested_out" &&
            !row.done &&
            (row.dueWeek === todayWeek ||
              (row.weekStart !== null &&
                row.weekEnd !== null &&
                row.weekStart <= todayWeek &&
                todayWeek <= row.weekEnd)),
        );

  const bridges = rows.filter((row) => row.status === "bridge" && !row.done);
  const comingUp =
    todayWeek === null
      ? []
      : rows.filter(
          (row) =>
            row.status === "required" &&
            !row.done &&
            row.dueWeek === todayWeek + 1,
        );

  const overdue =
    week0 === null
      ? []
      : rows.filter((row) => {
          if (row.done || (row.status !== "required" && row.status !== "bridge")) {
            return false;
          }
          if (row.dueWeek === null) {
            return false;
          }
          const range = weekDateRange(row.dueWeek, week0, breakRows);
          if (!range) {
            return false;
          }
          const todayKl = new Intl.DateTimeFormat("en-CA", {
            timeZone: "Asia/Kuala_Lumpur",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          }).format(new Date());
          return range.friday < todayKl;
        });

  const maySkip = rows.filter((row) => row.status === "tested_out");
  const done = rows.filter((row) => row.done);
  const optional = rows.filter((row) => row.status === "optional" && !row.done);

  return {
    kind: "plan_ready",
    plan: {
      streamLabel: profile?.stream ? streamNames[profile.stream as Stream] : "Not set",
      cohortName: cohort?.name ?? null,
      programmeWeekLine: weekLine || (week0 ? `Starts ${formatCalendarDate(week0)}` : ""),
      programmeWeek: todayWeek,
      requiredDone,
      requiredTotal: requiredRows.length,
      thisWeek,
      bridges,
      comingUp,
      overdue,
      maySkip,
      done,
      optional,
    },
  };
}

export async function loadTrainerPlanForUser(userId: string): Promise<TrainerPlanView> {
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email, stream, cohort_id, cohorts ( name, week0_start_date )")
    .eq("id", userId)
    .maybeSingle();

  const cohort = profile?.cohorts as { name: string; week0_start_date: string | null } | null;
  const breaks =
    profile?.cohort_id ? await loadCohortBreaksForCohort(profile.cohort_id) : [];
  const breakRows: CohortBreak[] = breaks.map((row) => ({
    startDate: row.startDate,
    weeks: row.weeks,
    label: row.label,
  }));
  const { week0 } = calendarContext(cohort?.week0_start_date, breakRows);

  const joined = await loadPlanRowsForUser(userId, supabase);
  const { lessonsByModule, progressByLesson } = await loadProgressMaps(userId, supabase);
  const quizByModule = await loadQuizStateByModule(userId, supabase);

  const rows = joined.map(({ meta, plan }) =>
    buildPlanModuleRow(
      meta,
      plan,
      lessonsByModule.get(meta.id) ?? [],
      progressByLesson,
      quizByModule.get(meta.id) ?? null,
      week0,
      breakRows,
    ),
  );

  return {
    userId,
    personName: profile?.full_name?.trim() || profile?.email || "Person",
    stream: (profile?.stream as Stream | null) ?? null,
    cohortName: cohort?.name ?? null,
    week0StartDate: cohort?.week0_start_date ?? null,
    breaks: breakRows,
    rows,
    hasPlan: rows.length > 0,
  };
}

export async function loadPlanBuiltAt(userId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("learner_plan")
    .select("created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return data?.created_at ?? null;
}
