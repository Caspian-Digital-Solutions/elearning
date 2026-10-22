import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { sections } from "@/config/navigation";
import { noteLastSeen, requireUser } from "@/lib/auth";
import { progressTabsForUser } from "@/lib/progress/access";
import {
  loadMyProgressPlan,
  loadProgressDepartments,
  loadProgressModules,
  loadProgressPeopleRows,
  loadProgressWeeklyActivity,
} from "@/lib/progress/queries";
import { ProgressPageClient } from "./progress-page-client";

export const metadata: Metadata = {
  title: "Progress",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default function ProgressPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <>
      <PageHeader title={sections.progress.title} purpose={sections.progress.purpose} />
      <Suspense fallback={<Skeleton className="h-96" aria-busy="true" aria-label="Loading progress" />}>
        <ProgressData searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function ProgressData({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser();
  await noteLastSeen(user);
  const params = await searchParams;
  const includeTestAccounts = params.test === "1" || params.test === "true";
  const mode = progressTabsForUser(user);
  const trainerView = mode === "trainer";
  const showTrainerMarks = user.actualRole === "trainer" || user.actualRole === "admin";

  const departmentScope =
    mode === "manager" && user.progressScope === "department" ? user.departmentId : null;

  const [people, departments, modules, weekly, myPlan] = await Promise.all([
    mode === "self"
      ? loadProgressPeopleRows({
          includeTestAccounts: false,
          trainerView: showTrainerMarks,
          onlyUserId: user.id,
        })
      : loadProgressPeopleRows({
          includeTestAccounts: trainerView && includeTestAccounts,
          trainerView: showTrainerMarks,
          departmentId: mode === "manager" ? departmentScope : undefined,
        }),
    mode === "self" ? Promise.resolve([]) : loadProgressDepartments(),
    mode === "trainer" ? loadProgressModules(showTrainerMarks) : Promise.resolve([]),
    mode === "trainer" ? loadProgressWeeklyActivity() : Promise.resolve([]),
    mode === "self" ? loadMyProgressPlan(user.id) : Promise.resolve(null),
  ]);

  const mySummary = mode === "self" ? (people[0] ?? null) : null;
  const planModules = myPlan
    ? [
        ...myPlan.thisWeek,
        ...myPlan.overdue,
        ...myPlan.comingUp,
        ...myPlan.bridges,
        ...myPlan.done,
        ...myPlan.maySkip,
        ...myPlan.optional,
      ]
    : null;

  const canOpenPerson =
    mode === "trainer" || (mode === "manager" && user.progressScope === "department");

  const filteredDepartments =
    mode === "manager" && departmentScope
      ? departments.filter((row) => row.department_id === departmentScope)
      : departments;

  return (
    <ProgressPageClient
      mode={mode}
      people={people}
      departments={filteredDepartments}
      modules={modules}
      weekly={weekly}
      myPlan={planModules}
      mySummary={mySummary}
      includeTestAccounts={includeTestAccounts}
      canOpenPerson={canOpenPerson}
      showTrainerMarks={showTrainerMarks}
    />
  );
}
