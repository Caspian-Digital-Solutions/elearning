"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { DataTable, type DataColumn, type DataFilter, type QuickFilter } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCount } from "@/lib/progress/format-count";
import type { ProgressDepartmentRow, ProgressModuleRow, ProgressWeeklyRow } from "@/lib/progress/types";
import type { ProgressPeopleTableRow } from "@/lib/progress/queries";
import type { PlanModuleRow } from "@/lib/plan/queries";

const peopleBaseColumns: DataColumn<ProgressPeopleTableRow>[] = [
  { key: "person", header: "Person" },
  { key: "department", header: "Department" },
  { key: "cohort", header: "Cohort" },
  { key: "stream", header: "Stream" },
  { key: "programmeWeek", header: "Programme week" },
  { key: "requiredModules", header: "Required modules" },
  { key: "bridgeModules", header: "Bridge modules" },
  { key: "testOut", header: "Test-out" },
  { key: "overdue", header: "Overdue modules", sortKey: "overdueSort" },
  { key: "lessons", header: "Lessons completed" },
  { key: "quizzes", header: "Quizzes passed" },
  { key: "assignments", header: "Assignments returned" },
  { key: "dataRules", header: "Data rules" },
  { key: "week0", header: "Week 0" },
  { key: "lastSeen", header: "Last seen", sortKey: "lastSeenSort" },
];

const trainerMarkColumns: DataColumn<ProgressPeopleTableRow>[] = [
  { key: "week0Total", header: "Week 0 total" },
  { key: "quizMarks", header: "Quiz best %", wrap: true },
  { key: "assignmentMarks", header: "Assignment marks", wrap: true },
];

const peopleFilters: DataFilter<ProgressPeopleTableRow>[] = [
  { key: "cohort", label: "Cohort" },
  { key: "department", label: "Department" },
  { key: "stream", label: "Stream" },
  { key: "hasOverdue", label: "Has overdue" },
];

const peopleQuickFilters: QuickFilter<ProgressPeopleTableRow>[] = [
  { label: "Has overdue", matches: (row) => row.hasOverdue === "Yes" },
];

type DepartmentTableRow = {
  department: string;
  people: string;
  week0: string;
  streams: string;
  required: string;
  dataRules: string;
  active7d: string;
};

type ModuleTableRow = {
  module: string;
  required: string;
  done: string;
  overdue: string;
  testOutPending: string;
  lessons: string;
  quizAttempts?: string;
  quizPasses?: string;
  submissions: string;
  returned: string;
  resubmits: string;
  medianDays?: string;
};

type WeeklyTableRow = {
  cohort: string;
  week: string;
  peopleActive: string;
  lessons: string;
  quizzes: string;
  assignments: string;
  feedback: string;
};

type PlanWeekRow = {
  week: string;
  module: string;
  status: string;
  due: string;
  lessons: string;
  quiz: string;
  sortKey: string;
};

export function ProgressScreen({
  mode,
  people,
  departments,
  modules,
  weekly,
  myPlan,
  mySummary,
  includeTestAccounts,
  onIncludeTestAccountsChange,
  canOpenPerson,
  showTrainerMarks,
  tabErrors,
}: {
  mode: "self" | "manager" | "trainer";
  people: ProgressPeopleTableRow[];
  departments: ProgressDepartmentRow[];
  modules: ProgressModuleRow[];
  weekly: ProgressWeeklyRow[];
  myPlan: PlanModuleRow[] | null;
  mySummary: ProgressPeopleTableRow | null;
  includeTestAccounts: boolean;
  onIncludeTestAccountsChange?: (value: boolean) => void;
  canOpenPerson: boolean;
  showTrainerMarks: boolean;
  tabErrors?: Partial<Record<"people" | "departments" | "modules" | "weekly" | "myPlan", string>>;
}) {
  function tabNotice(tab: keyof NonNullable<typeof tabErrors>) {
    const message = tabErrors?.[tab];
    if (!message) {
      return null;
    }
    return (
      <p className="mb-3 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive" role="alert">
        {message}
      </p>
    );
  }
  const [hiddenMarkColumns, setHiddenMarkColumns] = useState(
    () => new Set(trainerMarkColumns.map((column) => column.key)),
  );

  const peopleColumns = useMemo(() => {
    if (!showTrainerMarks) {
      return peopleBaseColumns;
    }
    return [
      ...peopleBaseColumns,
      ...trainerMarkColumns.filter((column) => !hiddenMarkColumns.has(column.key)),
    ];
  }, [hiddenMarkColumns, showTrainerMarks]);

  const departmentRows = useMemo<DepartmentTableRow[]>(
    () =>
      departments.map((row) => ({
        department: row.department_name,
        people: String(row.people),
        week0: `${row.week0_not_started} not started; ${row.week0_in_progress} in progress; ${row.week0_submitted} submitted; ${row.week0_confirmed} confirmed`,
        streams: `Foundation ${row.stream_foundation}; Practitioner ${row.stream_practitioner}; Fast track ${row.stream_practitioner_fast_track}; Champion ${row.stream_champion}`,
        required: formatCount(row.required_modules_done_sum, row.required_modules_total_sum),
        dataRules: String(row.data_rules_confirmed_count),
        active7d: String(row.active_last_7_days),
      })),
    [departments],
  );

  const moduleRows = useMemo<ModuleTableRow[]>(
    () =>
      modules.map((row) => ({
        module: `${row.module_code} — ${row.module_title}`,
        required: String(row.people_required),
        done: String(row.people_done),
        overdue: "—",
        testOutPending: String(row.test_out_pending),
        lessons: String(row.lesson_completions),
        quizAttempts: showTrainerMarks ? String(row.quiz_attempts) : undefined,
        quizPasses: showTrainerMarks ? String(row.quiz_passes) : undefined,
        submissions: String(row.assignment_submissions),
        returned: String(row.assignment_returned),
        resubmits: String(row.resubmit_requested),
        medianDays:
          showTrainerMarks && row.median_working_days_to_return !== null
            ? String(row.median_working_days_to_return)
            : undefined,
      })),
    [modules, showTrainerMarks],
  );

  const moduleColumns = useMemo<DataColumn<ModuleTableRow>[]>(() => {
    const base: DataColumn<ModuleTableRow>[] = [
      { key: "module", header: "Module", wrap: true },
      { key: "required", header: "People required" },
      { key: "done", header: "Done" },
      { key: "testOutPending", header: "Test-out pending" },
      { key: "lessons", header: "Lesson completions" },
      { key: "submissions", header: "Submissions" },
      { key: "returned", header: "Returned" },
      { key: "resubmits", header: "Resubmits requested" },
    ];
    if (showTrainerMarks) {
      base.splice(
        5,
        0,
        { key: "quizAttempts", header: "Quiz attempts" },
        { key: "quizPasses", header: "Quiz passes" },
        { key: "medianDays", header: "Median working days to return" },
      );
    }
    return base;
  }, [showTrainerMarks]);

  const weeklyRows = useMemo<WeeklyTableRow[]>(
    () =>
      weekly.map((row) => ({
        cohort: row.cohort_name,
        week: `Week ${row.programme_week}`,
        peopleActive: String(row.people_active),
        lessons: String(row.lessons_completed),
        quizzes: String(row.quizzes_submitted),
        assignments: String(row.assignments_submitted),
        feedback: String(row.feedback_released),
      })),
    [weekly],
  );

  const planByWeek = useMemo<PlanWeekRow[]>(() => {
    if (!myPlan) {
      return [];
    }
    return myPlan
      .map((row) => ({
        week: row.dueWeek === null ? "—" : `Week ${row.dueWeek}`,
        module: `${row.code} — ${row.title}`,
        status: row.done ? "Done" : row.status.replaceAll("_", " "),
        due: row.dueDateLabel ?? "—",
        lessons: formatCount(row.lessonsDone, row.lessonsTotal),
        quiz: row.quizLabel ?? "—",
        sortKey: `${row.dueWeek ?? 99}-${row.code}`,
      }))
      .sort((left, right) => left.sortKey.localeCompare(right.sortKey, "en", { numeric: true }));
  }, [myPlan]);

  const defaultTab = mode === "self" || mode === "trainer" ? "my" : "people";

  return (
    <Tabs defaultValue={defaultTab}>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <TabsList>
          {mode === "self" || mode === "trainer" ? <TabsTrigger value="my">My progress</TabsTrigger> : null}
          {mode !== "self" ? <TabsTrigger value="people">People</TabsTrigger> : null}
          {mode === "manager" || mode === "trainer" ? (
            <TabsTrigger value="departments">Department{mode === "trainer" ? "s" : ""}</TabsTrigger>
          ) : null}
          {mode === "trainer" || mode === "manager" ? (
            <TabsTrigger value="modules">Modules</TabsTrigger>
          ) : null}
          {mode === "trainer" || mode === "manager" ? (
            <TabsTrigger value="weekly">Weekly activity</TabsTrigger>
          ) : null}
        </TabsList>
        {mode === "trainer" && onIncludeTestAccountsChange ? (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4 accent-accent-strong"
              checked={includeTestAccounts}
              onChange={(event) => onIncludeTestAccountsChange(event.target.checked)}
            />
            Include test accounts
          </label>
        ) : null}
      </div>

      {mode === "self" || mode === "trainer" ? (
        <TabsContent value="my" className="space-y-6">
          {tabNotice("myPlan")}
          {mySummary ? (
            <DataTable
              columns={[
                { key: "requiredModules", header: "Required modules" },
                { key: "bridgeModules", header: "Bridge modules" },
                { key: "testOut", header: "Test-out" },
                { key: "overdue", header: "Overdue modules" },
                { key: "lessons", header: "Lessons completed" },
                { key: "quizzes", header: "Quizzes passed" },
                { key: "assignments", header: "Assignments returned" },
                { key: "dataRules", header: "Data rules" },
                { key: "week0", header: "Week 0" },
              ]}
              rows={[mySummary]}
              caption="Your progress counts"
              exportFileName="my-progress.csv"
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              Your plan is not ready yet. Complete Week 0 and wait for a trainer to confirm your stream.
            </p>
          )}
          <DataTable
            columns={[
              { key: "week", header: "Week" },
              { key: "module", header: "Module", wrap: true },
              { key: "status", header: "Status" },
              { key: "due", header: "Due" },
              { key: "lessons", header: "Lessons" },
              { key: "quiz", header: "Quiz" },
            ]}
            rows={planByWeek}
            caption="Modules by programme week"
            exportFileName="my-progress-modules.csv"
            emptyMessage="No modules on your plan yet."
          />
        </TabsContent>
      ) : null}

      <TabsContent value="people" className="space-y-3">
        {tabNotice("people")}
        {showTrainerMarks ? (
          <div className="flex flex-wrap gap-2">
            <Label className="sr-only">Mark columns</Label>
            {trainerMarkColumns.map((column) => (
              <Button
                key={column.key}
                type="button"
                size="sm"
                variant={hiddenMarkColumns.has(column.key) ? "outline" : "default"}
                onClick={() =>
                  setHiddenMarkColumns((current) => {
                    const next = new Set(current);
                    if (next.has(column.key)) {
                      next.delete(column.key);
                    } else {
                      next.add(column.key);
                    }
                    return next;
                  })
                }
              >
                {hiddenMarkColumns.has(column.key) ? "Show" : "Hide"} {column.header}
              </Button>
            ))}
          </div>
        ) : null}
        <DataTable
          columns={peopleColumns}
          rows={people}
          rowKey="userId"
          caption="People progress (counts only for managers)"
          exportFileName="progress-people.csv"
          filters={peopleFilters}
          quickFilters={peopleQuickFilters}
          rowActions={
            canOpenPerson
              ? (row) => (
                  <Button type="button" variant="outline" size="sm" render={<Link href={`/progress/person/${row.userId}`} />}>
                    View<span className="sr-only"> {row.person}</span>
                  </Button>
                )
              : undefined
          }
        />
      </TabsContent>

      {mode === "manager" || mode === "trainer" ? (
        <TabsContent value="departments">
          {tabNotice("departments")}
          <DataTable
            columns={[
              { key: "department", header: "Department" },
              { key: "people", header: "People" },
              { key: "week0", header: "Week 0", wrap: true },
              { key: "streams", header: "Confirmed by stream", wrap: true },
              { key: "required", header: "Required modules done" },
              { key: "dataRules", header: "Data rules confirmed" },
              { key: "active7d", header: "Active in last 7 days" },
            ]}
            rows={departmentRows}
            caption="Department summary"
            exportFileName="progress-departments.csv"
          />
        </TabsContent>
      ) : null}

      {mode === "trainer" || mode === "manager" ? (
        <TabsContent value="modules">
          {tabNotice("modules")}
          <DataTable
            columns={moduleColumns}
            rows={moduleRows}
            caption="Module summary"
            exportFileName="progress-modules.csv"
          />
        </TabsContent>
      ) : null}

      {mode === "trainer" || mode === "manager" ? (
        <TabsContent value="weekly">
          {tabNotice("weekly")}
          <DataTable
            columns={[
              { key: "cohort", header: "Cohort" },
              { key: "week", header: "Programme week" },
              { key: "peopleActive", header: "People active" },
              { key: "lessons", header: "Lessons completed" },
              { key: "quizzes", header: "Quizzes submitted" },
              { key: "assignments", header: "Assignments submitted" },
              { key: "feedback", header: "Feedback released" },
            ]}
            rows={weeklyRows}
            caption="Weekly activity by cohort"
            exportFileName="progress-weekly.csv"
          />
        </TabsContent>
      ) : null}
    </Tabs>
  );
}
