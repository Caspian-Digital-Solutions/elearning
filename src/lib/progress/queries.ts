import "server-only";

import { programmeWeekForDate } from "@/lib/calendar/programme-week";
import type { CohortBreak } from "@/lib/calendar/types";
import { formatDateTime } from "@/lib/format";
import { streamNames, type Stream } from "@/lib/people/labels";
import { loadMyPathState, type MyPathPlanView } from "@/lib/plan/queries";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { formatCount } from "@/lib/progress/format-count";
import { countOverdueModules } from "@/lib/progress/overdue";
import type {
  ProgressDepartmentRow,
  ProgressModuleRow,
  ProgressPersonPublicRow,
  ProgressPersonTrainerRow,
  ProgressWeeklyRow,
} from "@/lib/progress/types";

export type ProgressPeopleTableRow = {
  userId: string;
  person: string;
  department: string;
  cohort: string;
  stream: string;
  programmeWeek: string;
  requiredModules: string;
  bridgeModules: string;
  testOut: string;
  overdue: string;
  overdueSort: string;
  lessons: string;
  quizzes: string;
  assignments: string;
  dataRules: string;
  week0: string;
  lastSeen: string;
  lastSeenSort: string;
  hasOverdue: string;
  departmentId: string;
  cohortId: string;
  streamKey: string;
  week0Total?: string;
  quizMarks?: string;
  assignmentMarks?: string;
};

function progressFrom(supabase: SupabaseClient, table: string) {
  return (supabase as SupabaseClient & { from: (name: string) => ReturnType<SupabaseClient["from"]> }).from(table);
}

function streamLabel(stream: string | null): string {
  if (!stream) {
    return "—";
  }
  return streamNames[stream as Stream] ?? stream;
}

function testOutLabel(status: string): string {
  switch (status) {
    case "pending":
      return "Pending";
    case "passed":
      return "Passed";
    case "not_passed":
      return "Not passed";
    default:
      return "—";
  }
}

function week0Label(status: string): string {
  switch (status) {
    case "not_started":
      return "Not started";
    case "in_progress":
      return "In progress";
    case "submitted":
      return "Submitted";
    case "confirmed":
      return "Confirmed";
    default:
      return status;
  }
}

async function loadCohortBreaks(cohortId: string | null): Promise<CohortBreak[]> {
  if (!cohortId) {
    return [];
  }
  const supabase = await createClient();
  const { data } = await supabase
    .from("cohort_breaks")
    .select("start_date, weeks, label")
    .eq("cohort_id", cohortId)
    .order("start_date");
  return (data ?? []).map((row) => ({
    startDate: row.start_date,
    weeks: row.weeks,
    label: row.label,
  }));
}

async function programmeWeekLabel(cohortId: string | null): Promise<string> {
  if (!cohortId) {
    return "—";
  }
  const supabase = await createClient();
  const { data: cohort } = await supabase
    .from("cohorts")
    .select("week0_start_date")
    .eq("id", cohortId)
    .maybeSingle();
  if (!cohort?.week0_start_date) {
    return "—";
  }
  const breaks = await loadCohortBreaks(cohortId);
  const state = programmeWeekForDate(new Date(), cohort.week0_start_date, breaks);
  if (state.kind === "before_start") {
    return "Before Week 0";
  }
  if (state.kind === "break") {
    return state.label;
  }
  if (state.kind === "week") {
    return `Week ${state.programmeWeek}`;
  }
  return "—";
}

export async function loadProgressPeopleRows(options: {
  includeTestAccounts: boolean;
  trainerView: boolean;
  departmentId?: string | null;
  onlyUserId?: string;
}): Promise<ProgressPeopleTableRow[]> {
  const supabase = await createClient();
  const table = options.trainerView ? "progress_person_trainer" : "progress_person_public";
  // Views are added in migration 20261027100000; types are regenerated separately.
  let query = progressFrom(supabase, table).select("*").order("person_name");
  if (!options.includeTestAccounts) {
    query = query.eq("is_test_account", false);
  }
  if (options.onlyUserId) {
    query = query.eq("user_id", options.onlyUserId);
  }
  if (options.departmentId) {
    query = query.eq("department_id", options.departmentId);
  }
  const { data, error } = await query;
  if (error) {
    throw new Error("Could not load progress people.");
  }

  const rows = (data ?? []) as (ProgressPersonTrainerRow | ProgressPersonPublicRow)[];
  const overdueByUser = new Map<string, number>();
  for (const row of rows) {
    if (!row.cohort_id) {
      overdueByUser.set(row.user_id, 0);
      continue;
    }
    const breaks = await loadCohortBreaks(row.cohort_id);
    const supabaseInner = await createClient();
    const { data: cohort } = await supabaseInner
      .from("cohorts")
      .select("week0_start_date")
      .eq("id", row.cohort_id)
      .maybeSingle();
    const { data: plan } = await supabaseInner
      .from("learner_plan")
      .select("status, due_week")
      .eq("user_id", row.user_id);
    const planRows = (plan ?? []).map((item) => ({
      status: item.status,
      dueWeek: item.due_week,
      done: item.status === "tested_out",
    }));
    overdueByUser.set(
      row.user_id,
      countOverdueModules(planRows, cohort?.week0_start_date ?? null, breaks),
    );
  }

  const weekLabels = new Map<string, string>();
  for (const row of rows) {
    if (!weekLabels.has(row.cohort_id ?? "")) {
      weekLabels.set(row.cohort_id ?? "", await programmeWeekLabel(row.cohort_id));
    }
  }

  return rows.map((row) => {
    const overdue = overdueByUser.get(row.user_id) ?? 0;
    const trainer = row as ProgressPersonTrainerRow;
    return {
      userId: row.user_id,
      person: row.person_name,
      department: row.department_name ?? "—",
      cohort: row.cohort_name ?? "—",
      stream: streamLabel(row.stream),
      programmeWeek: weekLabels.get(row.cohort_id ?? "") ?? "—",
      requiredModules: formatCount(row.required_modules_done, row.required_modules_total),
      bridgeModules: formatCount(row.bridge_modules_done, row.bridge_modules_total),
      testOut: testOutLabel(row.test_out_status),
      overdue: String(overdue),
      overdueSort: String(overdue).padStart(5, "0"),
      lessons: String(row.lessons_completed),
      quizzes: formatCount(row.quizzes_passed, row.quizzes_completed),
      assignments: formatCount(row.assignments_returned, row.assignments_submitted),
      dataRules: row.data_rules_confirmed
        ? `Yes (v${row.data_rules_version ?? "—"})`
        : "No",
      week0: week0Label(row.week0_status),
      lastSeen: row.last_seen_at ? formatDateTime(row.last_seen_at) : "—",
      lastSeenSort: row.last_seen_at ?? "",
      hasOverdue: overdue > 0 ? "Yes" : "No",
      departmentId: row.department_id ?? "",
      cohortId: row.cohort_id ?? "",
      streamKey: row.stream ?? "",
      week0Total: options.trainerView ? (trainer.week0_total ?? "—") : undefined,
      quizMarks: options.trainerView ? (trainer.quiz_best_summary ?? "—") : undefined,
      assignmentMarks: options.trainerView ? (trainer.assignment_marks_summary ?? "—") : undefined,
    };
  });
}

export async function loadProgressDepartments(): Promise<ProgressDepartmentRow[]> {
  const supabase = await createClient();
  const { data, error } = await progressFrom(supabase, "progress_department_summary")
    .select("*")
    .order("department_name");
  if (error) {
    throw new Error("Could not load department progress.");
  }
  return (data ?? []) as ProgressDepartmentRow[];
}

export async function loadProgressModules(includeTrainerColumns: boolean): Promise<ProgressModuleRow[]> {
  const supabase = await createClient();
  const { data, error } = await progressFrom(supabase, "progress_module_summary").select("*").order("module_code");
  if (error) {
    throw new Error("Could not load module progress.");
  }
  const rows = (data ?? []) as ProgressModuleRow[];
  if (!includeTrainerColumns) {
    return rows.map((row) => ({
      ...row,
      quiz_attempts: 0,
      quiz_passes: 0,
      median_working_days_to_return: null,
    }));
  }
  return rows;
}

export async function loadProgressWeeklyActivity(): Promise<ProgressWeeklyRow[]> {
  const supabase = await createClient();
  const { data, error } = await progressFrom(supabase, "progress_weekly_activity")
    .select("*")
    .order("cohort_name")
    .order("programme_week");
  if (error) {
    throw new Error("Could not load weekly activity.");
  }
  return (data ?? []) as ProgressWeeklyRow[];
}

export async function loadMyProgressPlan(userId: string): Promise<MyPathPlanView | null> {
  const state = await loadMyPathState(userId);
  if (state.kind !== "plan_ready") {
    return null;
  }
  return state.plan;
}

export async function loadProgressPersonPublicRow(userId: string): Promise<ProgressPersonPublicRow | null> {
  const supabase = await createClient();
  const { data, error } = await progressFrom(supabase, "progress_person_public")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    throw new Error("Could not load person progress.");
  }
  return (data as ProgressPersonPublicRow | null) ?? null;
}
