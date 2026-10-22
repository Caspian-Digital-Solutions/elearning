import type { Metadata } from "next";
import { authorise, requireRole } from "@/lib/auth";
import { loadWeek0MarkingQueue } from "@/lib/assessments/queries";
import {
  listMarkingQueue,
  listModerationQueue,
  loadTrainerAssignments,
} from "@/lib/assignments/queries";
import { MarkingHubScreen } from "@/app/(app)/trainer/marking/marking-hub-screen";

export const metadata: Metadata = {
  title: "Marking queue",
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  await requireRole(["trainer", "admin", "champion"]);
  const user = await authorise(["trainer", "admin", "champion"]);
  const canModerate = user?.role === "trainer" || user?.role === "admin";
  const { tab } = await searchParams;

  const [week0Queue, assignmentQueue, moderationRows, assignments] = await Promise.all([
    loadWeek0MarkingQueue(true),
    listMarkingQueue(true),
    canModerate ? listModerationQueue() : Promise.resolve([]),
    canModerate ? loadTrainerAssignments() : Promise.resolve([]),
  ]);

  const assignmentOptions = assignments
    .filter((row) => row.statusLabel === "Published")
    .map((row) => ({ id: row.id, label: `${row.code} — ${row.title}` }));

  const defaultTab =
    tab === "assignments" || tab === "moderation" ? tab : "week0";

  return (
    <MarkingHubScreen
      week0Queue={week0Queue}
      assignmentQueue={assignmentQueue}
      moderationRows={moderationRows}
      assignmentOptions={assignmentOptions}
      canModerate={canModerate}
      defaultTab={defaultTab}
    />
  );
}
