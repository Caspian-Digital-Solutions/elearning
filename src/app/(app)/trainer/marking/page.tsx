import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { loadWeek0MarkingQueue } from "@/lib/assessments/queries";
import { MarkingScreen } from "@/app/(app)/trainer/marking/marking-screen";

export const metadata: Metadata = {
  title: "Marking queue",
};

export default async function Page() {
  await requireRole(["trainer", "admin", "champion"]);
  const queue = await loadWeek0MarkingQueue(true);
  return <MarkingScreen initialQueue={queue} />;
}
