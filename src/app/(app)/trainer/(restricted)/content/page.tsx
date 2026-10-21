import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { loadTrainerPages, loadTrainerUpdates } from "@/lib/content/queries";
import { loadTrainerLessons } from "@/lib/lessons/queries";
import { loadTrainerAssessments } from "@/lib/assessments/queries";
import { ContentScreen } from "@/app/(app)/trainer/(restricted)/content/content-screen";

export const metadata: Metadata = {
  title: "Content",
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  await requireRole(["trainer", "admin"]);
  const { tab } = await searchParams;
  const [pages, updates, lessons, assessments] = await Promise.all([
    loadTrainerPages(),
    loadTrainerUpdates(),
    loadTrainerLessons(),
    loadTrainerAssessments(),
  ]);
  const defaultTab =
    tab === "lessons" || tab === "updates" || tab === "assessments" ? tab : "pages";
  return (
    <ContentScreen
      pages={pages}
      updates={updates}
      lessons={lessons}
      assessments={assessments}
      defaultTab={defaultTab}
    />
  );
}
