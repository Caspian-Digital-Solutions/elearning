import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { sections } from "@/config/navigation";
import { noteLastSeen, requireUser } from "@/lib/auth";
import { progressTabsForUser } from "@/lib/progress/access";
import { loadProgressSection } from "@/lib/progress/load-section";
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
  const staffProgressTabs = mode === "trainer" || mode === "manager";
  const showTrainerMarks = user.actualRole === "trainer" || user.actualRole === "admin";

  const departmentScope =
    mode === "manager" && user.progressScope === "department" ? user.departmentId : null;

  const peopleResult = await loadProgressSection("people", () =>
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
  );

  const departmentsResult =
    mode === "self"
      ? { ok: true as const, data: [] }
      : await loadProgressSection("departments", () => loadProgressDepartments());

  const modulesResult = staffProgressTabs
    ? await loadProgressSection("modules", () => loadProgressModules(showTrainerMarks))
    : { ok: true as const, data: [] };

  const weeklyResult = staffProgressTabs
    ? await loadProgressSection("weekly", () => loadProgressWeeklyActivity())
    : { ok: true as const, data: [] };

  const myPlanResult =
    mode === "self" || mode === "trainer"
      ? await loadProgressSection("myPlan", () => loadMyProgressPlan(user.id))
      : { ok: true as const, data: null };

  const people = peopleResult.ok ? peopleResult.data : [];
  const departments = departmentsResult.ok ? departmentsResult.data : [];
  const modules = modulesResult.ok ? modulesResult.data : [];
  const weekly = weeklyResult.ok ? weeklyResult.data : [];
  const myPlan = myPlanResult.ok ? myPlanResult.data : null;

  const tabErrors: Partial<Record<"people" | "departments" | "modules" | "weekly" | "myPlan", string>> = {};
  if (!peopleResult.ok) {
    tabErrors.people = peopleResult.message;
  }
  if (!departmentsResult.ok) {
    tabErrors.departments = departmentsResult.message;
  }
  if (!modulesResult.ok) {
    tabErrors.modules = modulesResult.message;
  }
  if (!weeklyResult.ok) {
    tabErrors.weekly = weeklyResult.message;
  }
  if (!myPlanResult.ok) {
    tabErrors.myPlan = myPlanResult.message;
  }

  const mySummary =
    mode === "self" || mode === "trainer"
      ? (people.find((row) => row.userId === user.id) ?? people[0] ?? null)
      : null;
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
      tabErrors={tabErrors}
    />
  );
}
