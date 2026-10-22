import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { listLearnerAssignments } from "@/lib/assignments/queries";
import { AssignmentsScreen } from "@/app/(app)/assignments/assignments-screen";

export const metadata: Metadata = {
  title: "Assignments",
};

export default async function Page() {
  const user = await requireUser();
  const rows = await listLearnerAssignments(user.id);
  return <AssignmentsScreen rows={rows} />;
}
