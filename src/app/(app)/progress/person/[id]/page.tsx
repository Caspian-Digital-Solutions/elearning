import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { DataTable, type DataColumn } from "@/components/shared/data-table";
import { PageHeader } from "@/components/shared/page-header";
import { buttonVariants } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";
import { canViewProgressPerson } from "@/lib/progress/access";
import {
  loadMyProgressPlan,
  loadProgressPeopleRows,
  loadProgressPersonPublicRow,
  type ProgressPeopleTableRow,
} from "@/lib/progress/queries";
import { formatCount } from "@/lib/progress/format-count";

export const metadata: Metadata = {
  title: "Person progress",
};

type Params = Promise<{ id: string }>;

export default async function PersonProgressPage({ params }: { params: Params }) {
  const viewer = await requireUser();
  const { id } = await params;
  const row = await loadProgressPersonPublicRow(id);
  if (!row) {
    notFound();
  }
  if (!canViewProgressPerson(viewer, id, row.department_id)) {
    redirect("/progress");
  }

  const showMarks = viewer.actualRole === "trainer" || viewer.actualRole === "admin";
  const [summaryRows, plan] = await Promise.all([
    loadProgressPeopleRows({
      includeTestAccounts: row.is_test_account,
      trainerView: showMarks,
      onlyUserId: id,
    }),
    loadMyProgressPlan(id),
  ]);
  const summary = summaryRows[0];

  const planRows =
    plan
      ? [
          ...plan.thisWeek,
          ...plan.overdue,
          ...plan.comingUp,
          ...plan.bridges,
          ...plan.done,
          ...plan.maySkip,
          ...plan.optional,
        ].map((module) => ({
          week: module.dueWeek === null ? "—" : `Week ${module.dueWeek}`,
          module: `${module.code} — ${module.title}`,
          status: module.done ? "Done" : module.status.replaceAll("_", " "),
          due: module.dueDateLabel ?? "—",
          lessons: formatCount(module.lessonsDone, module.lessonsTotal),
          quiz: module.quizLabel ?? "—",
          sortKey: `${module.dueWeek ?? 99}-${module.code}`,
        }))
      : [];

  planRows.sort((left, right) => left.sortKey.localeCompare(right.sortKey, "en", { numeric: true }));

  return (
    <>
      <PageHeader
        title={row.person_name}
        purpose="Read-only plan and completion counts. Managers do not see marks."
      />
      <Link href="/progress" className={buttonVariants({ variant: "outline", size: "sm" })}>
        Back to progress
      </Link>
      {summary ? (
        <div className="mt-4">
          <DataTable
            columns={
              [
                { key: "requiredModules", header: "Required modules" },
                { key: "bridgeModules", header: "Bridge modules" },
                { key: "testOut", header: "Test-out" },
                { key: "overdue", header: "Overdue modules" },
                { key: "lessons", header: "Lessons completed" },
                { key: "quizzes", header: "Quizzes passed" },
                { key: "assignments", header: "Assignments returned" },
                { key: "dataRules", header: "Data rules" },
                { key: "week0", header: "Week 0" },
                ...(showMarks
                  ? [
                      { key: "week0Total", header: "Week 0 total" },
                      { key: "quizMarks", header: "Quiz best %", wrap: true },
                      { key: "assignmentMarks", header: "Assignment marks", wrap: true },
                    ]
                  : []),
              ] as DataColumn<ProgressPeopleTableRow>[]
            }
            rows={[summary]}
            caption="Summary"
            exportFileName={`progress-${id}.csv`}
          />
        </div>
      ) : null}
      <div className="mt-6">
        <DataTable
          columns={[
            { key: "week", header: "Week" },
            { key: "module", header: "Module", wrap: true },
            { key: "status", header: "Status" },
            { key: "due", header: "Due" },
            { key: "lessons", header: "Lessons" },
            { key: "quiz", header: "Quiz" },
          ]}
          rows={planRows}
          caption="Plan modules"
          exportFileName={`progress-plan-${id}.csv`}
          emptyMessage="No plan rows yet."
        />
      </div>
    </>
  );
}
