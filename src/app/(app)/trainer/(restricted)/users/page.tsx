import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { authorise } from "@/lib/auth";
import { loadCohorts, loadDepartments, loadPeople } from "@/lib/people/directory";
import { UsersScreen } from "./users-screen";

export const metadata: Metadata = {
  title: "Users",
};

export default function Page() {
  return (
    <>
      <PageHeader
        title="Users"
        purpose="Set each person's department, stream, pathway and cohort, and manage cohorts. People appear here after their first sign-in."
      />
      <Suspense fallback={<UsersLoading />}>
        <UsersData />
      </Suspense>
    </>
  );
}

async function UsersData() {
  const user = await authorise(["trainer", "admin"]);
  if (!user) {
    return null;
  }
  const [people, departments, cohorts] = await Promise.all([loadPeople(), loadDepartments(), loadCohorts()]);
  return (
    <UsersScreen
      people={people}
      departments={departments}
      cohorts={cohorts}
      currentUserId={user.id}
      isAdmin={user.actualRole === "admin"}
    />
  );
}

function UsersLoading() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading people">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[0, 1, 2, 3].map((item) => (
          <Skeleton key={item} className="h-20" />
        ))}
      </div>
      <Skeleton className="h-96" />
    </div>
  );
}
