import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { authorise } from "@/lib/auth";
import { loadPeople } from "@/lib/people/directory";
import { RolesScreen } from "./roles-screen";

export const metadata: Metadata = {
  title: "Roles",
};

export default function Page() {
  return (
    <>
      <PageHeader
        title="Roles"
        purpose="Change who can do what. Every change needs a reason and is recorded in the audit log."
      />
      <Suspense fallback={<Skeleton className="h-96" aria-busy="true" aria-label="Loading people" />}>
        <RolesData />
      </Suspense>
    </>
  );
}

async function RolesData() {
  const user = await authorise(["admin"]);
  if (!user) {
    return null;
  }
  const people = await loadPeople();
  return <RolesScreen people={people} currentUserId={user.id} />;
}
