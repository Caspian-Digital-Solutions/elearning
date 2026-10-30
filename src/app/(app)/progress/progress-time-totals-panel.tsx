"use client";

import { DataTable, type DataColumn } from "@/components/shared/data-table";
import type { DepartmentTaskStatRow } from "@/lib/timelog/queries";
import { smallGroupLabel, visibleForGroup } from "@/lib/timelog/stats";

type Row = {
  department: string;
  task: string;
  baselines: string;
  medianBaseline: string;
  logs: string;
  medianAi: string;
  outcomes: string;
};

export function ProgressTimeTotalsPanel({
  rows,
  minGroupSize,
  viewerIsTrainerOrAdmin,
}: {
  rows: DepartmentTaskStatRow[];
  minGroupSize: number;
  viewerIsTrainerOrAdmin: boolean;
}) {
  const rule = { minGroupSize, viewerIsTrainerOrAdmin };
  const tableRows: Row[] = rows.map((row) => {
    const showBaseline = visibleForGroup(row.peopleWithBaseline, rule);
    const showLogs = visibleForGroup(row.peopleLogging, rule);
    const hidden = smallGroupLabel(rule);
    return {
      department: row.departmentName,
      task: row.taskName,
      baselines: showBaseline ? String(row.peopleWithBaseline) : hidden,
      medianBaseline:
        showBaseline && row.medianBaselineMinutes !== null
          ? String(row.medianBaselineMinutes)
          : hidden,
      logs: showLogs ? String(row.logCount) : hidden,
      medianAi:
        showLogs && row.medianMinutesWithAi !== null ? String(row.medianMinutesWithAi) : hidden,
      outcomes: showLogs
        ? `Kept ${row.outcomeKept} · Edited ${row.outcomeEdited} · Discarded ${row.outcomeDiscarded}`
        : hidden,
    };
  });

  const columns: DataColumn<Row>[] = [
    { key: "department", header: "Department" },
    { key: "task", header: "Task", wrap: true },
    { key: "baselines", header: "People with baseline" },
    { key: "medianBaseline", header: "Median baseline (min)" },
    { key: "logs", header: "Log count" },
    { key: "medianAi", header: "Median with AI (min)" },
    { key: "outcomes", header: "Outcomes", wrap: true },
  ];

  return (
    <DataTable
      columns={columns}
      rows={tableRows}
      caption="Department and task totals (minutes)"
      exportFileName="time-log-totals.csv"
      emptyMessage="No time log data yet."
    />
  );
}
