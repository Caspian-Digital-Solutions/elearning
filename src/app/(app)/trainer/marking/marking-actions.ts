"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { authorise } from "@/lib/auth";
import { databaseMessage, notAllowed, type ActionResult } from "@/lib/actions/result";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/types/database";

const trainersMarking = ["trainer", "admin", "champion"] as const;

const saveMarkInput = z.strictObject({
  responseId: z.uuid(),
  criterionScores: z.record(z.string(), z.number()),
  commentMd: z.string().max(5000).optional(),
});

export async function saveMark(input: z.input<typeof saveMarkInput>): Promise<ActionResult> {
  if (!(await authorise(trainersMarking))) {
    return { ok: false, error: notAllowed };
  }
  const parsed = saveMarkInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "The mark could not be saved." };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("save_mark", {
    p_response_id: parsed.data.responseId,
    p_criterion_scores: parsed.data.criterionScores as Json,
    p_comment_md: parsed.data.commentMd ?? undefined,
  });
  if (error) {
    return { ok: false, error: databaseMessage(error, "The mark could not be saved.") };
  }
  revalidatePath("/trainer/marking");
  revalidatePath("/trainer/placements");
  return { ok: true, data: null };
}

export type MarkingDetail = {
  answer: Json;
  promptMd: string;
  modelAnswerMd: string | null;
  markingNotesMd: string | null;
  criteria: {
    id: string;
    name: string;
    maxScore: number;
    levels: { score: number; descriptor: string }[];
  }[];
};

export async function loadMarkingDetail(responseId: string): Promise<MarkingDetail | null> {
  if (!(await authorise(trainersMarking))) {
    return null;
  }
  const supabase = await createClient();
  const { data: response } = await supabase
    .from("responses")
    .select("id, answer, item_id")
    .eq("id", responseId)
    .maybeSingle();
  if (!response) {
    return null;
  }
  const { data: item } = await supabase
    .from("assessment_items")
    .select("prompt_md, rubric_id")
    .eq("id", response.item_id)
    .maybeSingle();
  const { data: keys } = await supabase
    .from("assessment_item_keys")
    .select("model_answer_md, marking_notes_md")
    .eq("item_id", response.item_id)
    .maybeSingle();

  const criteria: MarkingDetail["criteria"] = [];
  if (item?.rubric_id) {
    const { data: critRows } = await supabase
      .from("rubric_criteria")
      .select("id, name, max_score, sort_order")
      .eq("rubric_id", item.rubric_id)
      .order("sort_order");
    for (const crit of critRows ?? []) {
      const { data: levels } = await supabase
        .from("rubric_levels")
        .select("score, descriptor")
        .eq("criterion_id", crit.id)
        .order("score");
      criteria.push({
        id: crit.id,
        name: crit.name,
        maxScore: crit.max_score,
        levels: levels ?? [],
      });
    }
  }

  return {
    answer: response.answer,
    promptMd: item?.prompt_md ?? "",
    modelAnswerMd: keys?.model_answer_md ?? null,
    markingNotesMd: keys?.marking_notes_md ?? null,
    criteria,
  };
}
