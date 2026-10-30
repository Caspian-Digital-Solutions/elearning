"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DataTable, type DataColumn } from "@/components/shared/data-table";
import { saveBaselineAction, saveTimeLogAction } from "@/lib/timelog/actions";
import type { MyBaselineRow, MyNumbersRow, MyTimeLogRow } from "@/lib/timelog/queries";
import { f7TimeLogLabel } from "@/lib/timelog/stats";

type TaskOption = { id: string; name: string; code: string };

export function ProgressMyTimeLogPanel({
  baselines,
  logs,
  numbers,
  tasks,
  f7Logged,
  f7Required,
}: {
  baselines: MyBaselineRow[];
  logs: MyTimeLogRow[];
  numbers: MyNumbersRow[];
  tasks: TaskOption[];
  f7Logged: number;
  f7Required: number;
}) {
  const [pending, startTransition] = useTransition();
  const [baselineTask, setBaselineTask] = useState(tasks[0]?.id ?? "");
  const [baselineMinutes, setBaselineMinutes] = useState("60");
  const [baselineBasis, setBaselineBasis] = useState<"measured" | "estimate">("estimate");

  const numberColumns: DataColumn<Record<string, string>>[] = [
    { key: "taskName", header: "Task" },
    { key: "baselineMinutes", header: "Baseline (min)" },
    { key: "logCount", header: "Logs" },
    { key: "medianMinutesWithAi", header: "Median with AI (min)" },
    { key: "differenceMinutes", header: "Difference (min)" },
  ];

  const numberRows = numbers.map((row) => ({
    ...row,
    baselineMinutes: row.baselineMinutes === null ? "—" : String(row.baselineMinutes),
    logCount: String(row.logCount),
    medianMinutesWithAi: row.medianMinutesWithAi === null ? "—" : String(row.medianMinutesWithAi),
    differenceMinutes: row.differenceMinutes === null ? "—" : String(row.differenceMinutes),
  }));

  return (
    <div className="space-y-8">
      <p className="text-sm text-muted-foreground">
        Your own numbers. Your manager sees only department totals, never your individual entries.
      </p>
      <p className="text-sm font-medium">{f7TimeLogLabel(f7Logged, f7Required)}</p>

      <section className="space-y-3">
        <h3 className="text-base font-semibold text-heading">Baselines</h3>
        <ul className="space-y-2 text-sm">
          {baselines.map((row) => (
            <li key={row.taskId} className="rounded-md border border-border p-3">
              <div className="font-medium">{row.taskName}</div>
              <div className="text-muted-foreground">{row.unit}</div>
              <div className="mt-1">
                {row.minutesWithoutAi === null
                  ? "No baseline yet"
                  : `${row.minutesWithoutAi} min (${row.basis})`}
                {row.locked ? " · Locked" : ""}
              </div>
            </li>
          ))}
        </ul>
        {tasks.length > 0 ? (
          <form
            className="flex flex-wrap items-end gap-3 rounded-md border border-border p-3"
            onSubmit={(event) => {
              event.preventDefault();
              startTransition(async () => {
                const result = await saveBaselineAction(
                  baselineTask,
                  Number(baselineMinutes),
                  baselineBasis,
                );
                if (!result.ok) {
                  toast.error(result.error);
                  return;
                }
                toast.success("Baseline saved");
              });
            }}
          >
            <label className="flex flex-col gap-1 text-sm">
              Task
              <select
                className="rounded border border-border bg-background px-2 py-1"
                value={baselineTask}
                onChange={(e) => setBaselineTask(e.target.value)}
              >
                {tasks.map((task) => (
                  <option key={task.id} value={task.id}>
                    {task.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Minutes without AI
              <input
                type="number"
                min={1}
                max={2400}
                className="w-28 rounded border border-border bg-background px-2 py-1"
                value={baselineMinutes}
                onChange={(e) => setBaselineMinutes(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Basis
              <select
                className="rounded border border-border bg-background px-2 py-1"
                value={baselineBasis}
                onChange={(e) => setBaselineBasis(e.target.value as "measured" | "estimate")}
              >
                <option value="measured">Measured</option>
                <option value="estimate">Estimate</option>
              </select>
            </label>
            <Button type="submit" disabled={pending}>
              Save baseline
            </Button>
          </form>
        ) : (
          <p className="text-sm text-muted-foreground">No tasks for your department yet.</p>
        )}
      </section>

      <section className="space-y-3">
        <h3 className="text-base font-semibold text-heading">Log time</h3>
        <TimeLogForm tasks={tasks} pending={pending} startTransition={startTransition} />
      </section>

      <section className="space-y-3">
        <h3 className="text-base font-semibold text-heading">My numbers</h3>
        <DataTable
          columns={numberColumns}
          rows={numberRows}
          caption="Per-task minutes"
          exportFileName="my-time-numbers.csv"
        />
      </section>

      <section className="space-y-3">
        <h3 className="text-base font-semibold text-heading">Recent logs</h3>
        <ul className="space-y-2 text-sm">
          {logs.slice(0, 20).map((row) => (
            <li key={row.id} className="rounded-md border border-border p-3">
              {row.loggedOn} · {row.taskName} · {row.minutesWithAi} min · {row.outcome}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function TimeLogForm({
  tasks,
  pending,
  startTransition,
}: {
  tasks: TaskOption[];
  pending: boolean;
  startTransition: (fn: () => void) => void;
}) {
  const [taskId, setTaskId] = useState(tasks[0]?.id ?? "");
  const [loggedOn, setLoggedOn] = useState(new Date().toISOString().slice(0, 10));
  const [minutes, setMinutes] = useState("30");
  const [outcome, setOutcome] = useState<"kept" | "edited_heavily" | "discarded">("kept");
  const [note, setNote] = useState("");
  const [declaration, setDeclaration] = useState(false);

  if (tasks.length === 0) {
    return null;
  }

  return (
    <form
      className="flex flex-col gap-3 rounded-md border border-border p-3"
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(async () => {
          const result = await saveTimeLogAction({
            logId: null,
            taskId,
            loggedOn,
            minutes: Number(minutes),
            outcome,
            tools: ["claude"],
            skillId: null,
            promptId: null,
            note,
            declaration,
          });
          if (!result.ok) {
            toast.error(result.error);
            return;
          }
          toast.success("Time log saved");
          setNote("");
          setDeclaration(false);
        });
      }}
    >
      <div className="flex flex-wrap gap-3">
        <label className="flex flex-col gap-1 text-sm">
          Task
          <select
            className="rounded border border-border bg-background px-2 py-1"
            value={taskId}
            onChange={(e) => setTaskId(e.target.value)}
          >
            {tasks.map((task) => (
              <option key={task.id} value={task.id}>
                {task.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Date
          <input
            type="date"
            className="rounded border border-border bg-background px-2 py-1"
            value={loggedOn}
            onChange={(e) => setLoggedOn(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Minutes with AI
          <input
            type="number"
            min={1}
            max={2400}
            className="w-28 rounded border border-border bg-background px-2 py-1"
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Outcome
          <select
            className="rounded border border-border bg-background px-2 py-1"
            value={outcome}
            onChange={(e) => setOutcome(e.target.value as typeof outcome)}
          >
            <option value="kept">Kept</option>
            <option value="edited_heavily">Edited heavily</option>
            <option value="discarded">Discarded</option>
          </select>
        </label>
      </div>
      <label className="flex flex-col gap-1 text-sm">
        Note (optional, 300 characters)
        <textarea
          className="min-h-16 rounded border border-border bg-background px-2 py-1"
          maxLength={300}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={declaration}
          onChange={(e) => setDeclaration(e.target.checked)}
        />
        This entry has no client data
      </label>
      <Button type="submit" disabled={pending || !declaration}>
        Save log
      </Button>
    </form>
  );
}
