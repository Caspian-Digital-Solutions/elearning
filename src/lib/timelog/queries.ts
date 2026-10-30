import "server-only";

import { createClient } from "@/lib/supabase/server";
import { timelogMinGroupSize, timelogF7Required } from "@/lib/timelog/settings";

export type BaselineTaskRow = {
  id: string;
  code: string;
  name: string;
  description: string;
  unit: string;
  is_active: boolean;
  sort_order: number;
};

export type MyBaselineRow = {
  taskId: string;
  taskCode: string;
  taskName: string;
  unit: string;
  minutesWithoutAi: number | null;
  basis: string | null;
  locked: boolean;
};

export type MyTimeLogRow = {
  id: string;
  taskId: string;
  taskCode: string;
  taskName: string;
  loggedOn: string;
  minutesWithAi: number;
  outcome: string;
  tools: string[];
  note: string;
  createdAt: string;
  editable: boolean;
};

export type MyNumbersRow = {
  taskId: string;
  taskCode: string;
  taskName: string;
  baselineMinutes: number | null;
  logCount: number;
  medianMinutesWithAi: number | null;
  differenceMinutes: number | null;
};

export async function loadDepartmentTasks(departmentId: string): Promise<BaselineTaskRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("baseline_tasks")
    .select("id, code, name, description, unit, is_active, sort_order")
    .eq("department_id", departmentId)
    .eq("is_active", true)
    .order("sort_order")
    .order("name");
  if (error) {
    throw new Error("Could not load tasks.");
  }
  return (data ?? []) as BaselineTaskRow[];
}

export async function loadF7DistinctLogCount(userId: string): Promise<number> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("timelog_f7_distinct_tasks", { p_user_id: userId });
  if (error) {
    return 0;
  }
  return typeof data === "number" ? data : 0;
}

export async function loadMyTimelogBundle(userId: string, departmentId: string | null) {
  if (!departmentId) {
    return {
      tasks: [] as BaselineTaskRow[],
      baselines: [] as MyBaselineRow[],
      logs: [] as MyTimeLogRow[],
      numbers: [] as MyNumbersRow[],
      f7Required: await timelogF7Required(),
      f7Logged: 0,
    };
  }
  const supabase = await createClient();
  const tasks = await loadDepartmentTasks(departmentId);
  const taskIds = tasks.map((t) => t.id);

  const { data: baselineRows } = await supabase
    .from("baselines")
    .select("task_id, minutes_without_ai, basis, locked_at")
    .eq("user_id", userId)
    .in("task_id", taskIds.length ? taskIds : ["00000000-0000-0000-0000-000000000000"]);

  const { data: logRows } = await supabase
    .from("time_logs")
    .select("id, task_id, logged_on, minutes_with_ai, outcome, tools, note, created_at")
    .eq("user_id", userId)
    .order("logged_on", { ascending: false });

  const baselineByTask = new Map((baselineRows ?? []).map((b) => [b.task_id, b]));
  const logs = (logRows ?? []) as {
    id: string;
    task_id: string;
    logged_on: string;
    minutes_with_ai: number;
    outcome: string;
    tools: string[];
    note: string;
    created_at: string;
  }[];

  const baselines: MyBaselineRow[] = tasks.map((task) => {
    const row = baselineByTask.get(task.id);
    return {
      taskId: task.id,
      taskCode: task.code,
      taskName: task.name,
      unit: task.unit,
      minutesWithoutAi: row?.minutes_without_ai ?? null,
      basis: row?.basis ?? null,
      locked: Boolean(row?.locked_at),
    };
  });

  const taskMap = new Map(tasks.map((t) => [t.id, t]));
  const myLogs: MyTimeLogRow[] = logs.map((row) => {
    const task = taskMap.get(row.task_id);
    const editableUntil = Date.parse(row.created_at) + 7 * 86400000;
    return {
      id: row.id,
      taskId: row.task_id,
      taskCode: task?.code ?? "—",
      taskName: task?.name ?? "—",
      loggedOn: row.logged_on,
      minutesWithAi: row.minutes_with_ai,
      outcome: row.outcome,
      tools: row.tools ?? [],
      note: row.note,
      createdAt: row.created_at,
      editable: Date.now() <= editableUntil,
    };
  });

  const minutesByTask = new Map<string, number[]>();
  for (const row of logs) {
    const list = minutesByTask.get(row.task_id) ?? [];
    list.push(row.minutes_with_ai);
    minutesByTask.set(row.task_id, list);
  }

  const numbers: MyNumbersRow[] = tasks.map((task) => {
    const baseline = baselineByTask.get(task.id);
    const mins = minutesByTask.get(task.id) ?? [];
    const sorted = [...mins].sort((a, b) => a - b);
    const median =
      sorted.length === 0
        ? null
        : sorted.length % 2 === 1
          ? sorted[(sorted.length - 1) / 2]!
          : (sorted[sorted.length / 2 - 1]! + sorted[sorted.length / 2]!) / 2;
    const baselineMinutes = baseline?.minutes_without_ai ?? null;
    return {
      taskId: task.id,
      taskCode: task.code,
      taskName: task.name,
      baselineMinutes,
      logCount: mins.length,
      medianMinutesWithAi: median,
      differenceMinutes:
        baselineMinutes !== null && median !== null ? baselineMinutes - median : null,
    };
  });

  const f7Logged = await loadF7DistinctLogCount(userId);
  const f7Required = await timelogF7Required();

  return { tasks, baselines, logs: myLogs, numbers, f7Required, f7Logged };
}

export type DepartmentTaskStatRow = {
  departmentId: string;
  departmentName: string;
  departmentCode: string;
  taskId: string;
  taskCode: string;
  taskName: string;
  peopleWithBaseline: number;
  medianBaselineMinutes: number | null;
  peopleLogging: number;
  logCount: number;
  medianMinutesWithAi: number | null;
  outcomeKept: number;
  outcomeEdited: number;
  outcomeDiscarded: number;
};

export async function loadDepartmentTaskStats(): Promise<DepartmentTaskStatRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("time_log_department_task_stats").select("*");
  if (error) {
    throw new Error("Could not load time log totals.");
  }
  return (data ?? []).map((row) => ({
    departmentId: row.department_id as string,
    departmentName: row.department_name as string,
    departmentCode: row.department_code as string,
    taskId: row.task_id as string,
    taskCode: row.task_code as string,
    taskName: row.task_name as string,
    peopleWithBaseline: Number(row.people_with_baseline ?? 0),
    medianBaselineMinutes:
      row.median_baseline_minutes === null ? null : Number(row.median_baseline_minutes),
    peopleLogging: Number(row.people_logging ?? 0),
    logCount: Number(row.log_count ?? 0),
    medianMinutesWithAi:
      row.median_minutes_with_ai === null ? null : Number(row.median_minutes_with_ai),
    outcomeKept: Number(row.outcome_kept ?? 0),
    outcomeEdited: Number(row.outcome_edited ?? 0),
    outcomeDiscarded: Number(row.outcome_discarded ?? 0),
  }));
}

export async function loadTrainerTimeLogRows(includeTestAccounts: boolean) {
  const supabase = await createClient();
  let query = supabase.from("time_log_trainer_rows").select("*").order("logged_on", { ascending: false });
  if (!includeTestAccounts) {
    query = query.eq("is_test_account", false);
  }
  const { data, error } = await query.limit(500);
  if (error) {
    throw new Error("Could not load time log rows.");
  }
  return data ?? [];
}

export { timelogMinGroupSize, timelogF7Required };
