import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { authorise } from "@/lib/auth";
import { loadPeople } from "@/lib/people/directory";
import { PeopleAdminScreen } from "./people-admin-screen";

export const metadata: Metadata = {
  title: "People and data",
};

export default function AdminPeoplePage() {
  return (
    <>
      <PageHeader
        title="People and data"
        purpose="Mark leavers, export personal data for access requests, and open the retention list."
      />
      <Suspense fallback={<Skeleton className="h-96" aria-busy="true" aria-label="Loading people" />}>
        <PeopleData />
      </Suspense>
    </>
  );
}

async function PeopleData() {
  const user = await authorise(["admin"]);
  if (!user) {
    return null;
  }
  const people = await loadPeople();
  const activeAdminCount = people.filter((person) => person.isActive && person.role === "admin").length;
  return (
    <PeopleAdminScreen people={people} currentUserId={user.id} activeAdminCount={activeAdminCount} />
  );
}
