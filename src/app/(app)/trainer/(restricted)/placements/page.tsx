import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import {
  loadPlacementTableRows,
  loadQuizQuestionCheck,
  loadQuizResultsRows,
  loadSampleInProgressPlacementRows,
} from "@/lib/assessments/queries";
import { tallyProfileResponses } from "@/lib/assessments/profile-answers";
import { createClient } from "@/lib/supabase/server";
import { fetchQuizQuestionCheck } from "@/app/(app)/trainer/(restricted)/placements/placement-actions";
import { PlacementsScreen } from "@/app/(app)/trainer/(restricted)/placements/placements-screen";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = {
  title: "Placements",
};

export default async function Page() {
  await requireRole(["trainer", "admin"]);
  const supabase = await createClient();
  const placementRows = await loadPlacementTableRows();
  const sampleInProgressRows = await loadSampleInProgressPlacementRows();
  const quizResultsRows = await loadQuizResultsRows();

  const { data: quizAssessments } = await supabase
    .from("assessments")
    .select("id, code, title")
    .eq("status", "published")
    .in("type", ["quiz", "safety_quiz"])
    .order("code");

  const quizOptions = (quizAssessments ?? []).map((row) => ({
    id: row.id,
    code: row.code,
    label: `${row.code} — ${row.title}`,
  }));

  const questionCheckAssessmentId = quizAssessments?.[0]?.id ?? null;
  const questionCheckRows = questionCheckAssessmentId
    ? await loadQuizQuestionCheck(questionCheckAssessmentId)
    : [];

  const { data: placement } = await supabase
    .from("assessments")
    .select("id")
    .eq("type", "placement")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const profileRows: { question: string; option: string; count: number; department: string }[] = [];
  const notStartedRows: { name: string; department: string; lastSeen: string }[] = [];

  if (placement) {
    const { data: profileItems } = await supabase
      .from("assessment_items")
      .select("id, ref, options")
      .eq("assessment_id", placement.id)
      .eq("type", "profile");
    const optionsByItemId = new Map(
      (profileItems ?? []).map((item) => [
        item.id,
        Array.isArray(item.options)
          ? item.options
              .map((opt) => {
                if (typeof opt !== "object" || opt === null) {
                  return null;
                }
                const record = opt as Record<string, unknown>;
                const id = typeof record.id === "string" ? record.id : "";
                const text = typeof record.text === "string" ? record.text : id;
                return id ? { id, text } : null;
              })
              .filter((opt): opt is { id: string; text: string } => opt !== null)
          : [],
      ]),
    );

    const { data: attemptRows } = await supabase
      .from("attempts")
      .select("id")
      .eq("assessment_id", placement.id);
    const placementAttemptIds = (attemptRows ?? []).map((a) => a.id);

    const { data: responses } = profileItems?.length && placementAttemptIds.length
      ? await supabase
          .from("responses")
          .select("answer, item_id")
          .in("attempt_id", placementAttemptIds)
          .in("item_id", (profileItems ?? []).map((i) => i.id))
      : { data: [] };

    const refByItemId = new Map((profileItems ?? []).map((i) => [i.id, i.ref]));
    const tallies = tallyProfileResponses(
      (responses ?? []).map((row) => ({
        itemRef: refByItemId.get(row.item_id) ?? "—",
        answer: row.answer as Record<string, unknown>,
        options: optionsByItemId.get(row.item_id) ?? [],
      })),
    );
    for (const [key, count] of tallies) {
      const [question, option] = key.split(":");
      profileRows.push({ question, option, count, department: "All" });
    }

    const { data: learners } = await supabase
      .from("profiles")
      .select("id, full_name, email, last_seen_at, departments ( name, code )")
      .eq("is_active", true)
      .eq("is_test_account", false)
      .in("role", ["learner", "champion"]);

    const { data: submitted } = await supabase
      .from("attempts")
      .select("user_id")
      .eq("assessment_id", placement.id)
      .neq("status", "in_progress");

    const submittedIds = new Set((submitted ?? []).map((a) => a.user_id));
    for (const person of learners ?? []) {
      if (submittedIds.has(person.id)) {
        continue;
      }
      const dept = person.departments as { name: string; code: string } | null;
      notStartedRows.push({
        name: person.full_name?.trim() || person.email,
        department: dept?.name ?? dept?.code ?? "—",
        lastSeen: person.last_seen_at ? formatDate(person.last_seen_at) : "—",
      });
    }
  }

  return (
    <PlacementsScreen
      placementRows={placementRows}
      sampleInProgressRows={sampleInProgressRows}
      profileRows={profileRows}
      notStartedRows={notStartedRows}
      assessmentId={placement?.id ?? null}
      quizResultsRows={quizResultsRows}
      quizOptions={quizOptions}
      questionCheckRows={questionCheckRows}
      initialQuestionCheckAssessmentId={questionCheckAssessmentId}
      onLoadQuestionCheck={fetchQuizQuestionCheck}
    />
  );
}
