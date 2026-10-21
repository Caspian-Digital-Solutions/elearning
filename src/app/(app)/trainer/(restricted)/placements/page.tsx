import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { loadPlacementTableRows } from "@/lib/assessments/queries";
import { createClient } from "@/lib/supabase/server";
import { PlacementsScreen } from "@/app/(app)/trainer/(restricted)/placements/placements-screen";

export const metadata: Metadata = {
  title: "Placements",
};

export default async function Page() {
  await requireRole(["trainer", "admin"]);
  const supabase = await createClient();
  const placementRows = await loadPlacementTableRows();

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
      .select("id, ref")
      .eq("assessment_id", placement.id)
      .eq("type", "profile");
    const profileItemIds = (profileItems ?? []).map((i) => i.id);
    const refByItemId = new Map((profileItems ?? []).map((i) => [i.id, i.ref]));

    const { data: attemptRows } = await supabase
      .from("attempts")
      .select("id")
      .eq("assessment_id", placement.id);
    const placementAttemptIds = (attemptRows ?? []).map((a) => a.id);

    const { data: responses } = profileItemIds.length && placementAttemptIds.length
      ? await supabase
          .from("responses")
          .select("answer, item_id")
          .in("attempt_id", placementAttemptIds)
          .in("item_id", profileItemIds)
      : { data: [] };

    const counts = new Map<string, number>();
    for (const row of responses ?? []) {
      const ref = refByItemId.get(row.item_id) ?? "—";
      const answer = row.answer as { option_id?: string };
      const key = `${ref}:${answer.option_id ?? "—"}:all`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    for (const [key, count] of counts) {
      const [question, option] = key.split(":");
      profileRows.push({ question, option, count, department: "All" });
    }

    const { data: learners } = await supabase
      .from("profiles")
      .select("id, full_name, email, last_seen_at, departments ( name, code )")
      .eq("is_active", true)
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
        lastSeen: person.last_seen_at ? new Date(person.last_seen_at).toLocaleDateString() : "—",
      });
    }
  }

  return (
    <PlacementsScreen
      placementRows={placementRows}
      profileRows={profileRows}
      notStartedRows={notStartedRows}
      assessmentId={placement?.id ?? null}
    />
  );
}
