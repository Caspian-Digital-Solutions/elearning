import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { loadTrainerPages, loadTrainerUpdates } from "@/lib/content/queries";
import { loadTrainerLessons } from "@/lib/lessons/queries";
import { loadTrainerAssessments } from "@/lib/assessments/queries";
import { loadTrainerAssignments } from "@/lib/assignments/queries";
import { loadReviewQueue, loadTrainerPrompts } from "@/lib/prompts/queries";
import { createClient } from "@/lib/supabase/server";
import { ContentScreen } from "@/app/(app)/trainer/(restricted)/content/content-screen";

export const metadata: Metadata = {
  title: "Content",
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const user = await requireUser();
  if (user.role !== "champion" && user.actualRole !== "trainer" && user.actualRole !== "admin") {
    return null;
  }
  const { tab } = await searchParams;
  const championOnly = user.role === "champion";
  const supabase = await createClient();
  const [
    pages,
    updates,
    lessons,
    assessments,
    assignments,
    prompts,
    reviewQueue,
    departments,
    modules,
  ] = await Promise.all([
    loadTrainerPages(),
    loadTrainerUpdates(),
    loadTrainerLessons(),
    loadTrainerAssessments(),
    loadTrainerAssignments(),
    loadTrainerPrompts(),
    loadReviewQueue(),
    supabase.from("departments").select("code"),
    supabase.from("modules").select("code"),
  ]);
  const defaultTab = championOnly
    ? "prompts"
    : tab === "lessons" ||
        tab === "updates" ||
        tab === "assessments" ||
        tab === "assignments" ||
        tab === "prompts"
      ? tab
      : "pages";
  return (
    <ContentScreen
      championOnly={championOnly}
      pages={pages}
      updates={updates}
      lessons={lessons}
      assessments={assessments}
      assignments={assignments}
      prompts={prompts}
      reviewQueue={(reviewQueue ?? []).map((row) => ({
        id: row.id,
        title: row.title,
        submit_notes_md: row.submit_notes_md,
        submitter: row.submitter as { full_name: string | null } | null,
      }))}
      promptImportCodes={{
        departmentCodes: (departments.data ?? []).map((d) => d.code),
        moduleCodes: (modules.data ?? []).map((m) => m.code),
      }}
      defaultTab={defaultTab}
    />
  );
}
