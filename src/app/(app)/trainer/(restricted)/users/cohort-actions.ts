"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { authorise } from "@/lib/auth";
import { databaseMessage, notAllowed, type ActionResult } from "@/lib/actions/result";
import { isMondayDate } from "@/lib/calendar/cohort-preview";
import { createClient } from "@/lib/supabase/server";

const trainersAndAdmins = ["trainer", "admin"] as const;

const breakRow = z.strictObject({
  id: z.uuid().optional(),
  startDate: z.iso.date({ error: "Each break needs a Monday start date." }),
  weeks: z.number().int().min(1).max(12),
  label: z.string().trim().min(1, { error: "Give each break a label." }).max(200),
});

const cohortSaveInput = z.strictObject({
  id: z.uuid().optional(),
  name: z
    .string()
    .trim()
    .min(1, { error: "Give the cohort a name." })
    .max(100, { error: "Keep the name under 100 characters." }),
  startDate: z
    .union([z.iso.date({ error: "Enter the legacy start date." }), z.literal("")])
    .transform((value) => value || null),
  week0StartDate: z
    .union([z.iso.date({ error: "Week 0 must be a Monday date." }), z.literal("")])
    .transform((value) => value || null),
  slot: z
    .string()
    .trim()
    .max(100, { error: "Keep the weekly slot under 100 characters." })
    .transform((value) => value || null),
  notes: z
    .string()
    .trim()
    .max(1000, { error: "Keep the notes under 1,000 characters." })
    .transform((value) => value || null),
  breaks: z.array(breakRow).default([]),
});

export type CohortSaveInput = z.input<typeof cohortSaveInput>;

export async function saveCohortWithCalendar(input: CohortSaveInput): Promise<ActionResult<{ id: string }>> {
  if (!(await authorise(trainersAndAdmins))) {
    return { ok: false, error: notAllowed };
  }
  const parsed = cohortSaveInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  }
  const { id, name, startDate, week0StartDate, slot, notes, breaks } = parsed.data;

  if (week0StartDate && !isMondayDate(week0StartDate)) {
    return { ok: false, error: "Week 0 must start on a Monday." };
  }
  for (const breakRow of breaks) {
    if (!isMondayDate(breakRow.startDate)) {
      return { ok: false, error: "Each break must start on a Monday." };
    }
  }

  const supabase = await createClient();
  const fields = {
    name,
    start_date: startDate ?? week0StartDate,
    week0_start_date: week0StartDate,
    slot,
    notes,
  };

  const cohortResult = id
    ? await supabase.from("cohorts").update(fields).eq("id", id).select("id").maybeSingle()
    : await supabase.from("cohorts").insert(fields).select("id").single();

  if (cohortResult.error?.code === "23505") {
    return { ok: false, error: "Another cohort already has that name. Choose a different name." };
  }
  if (cohortResult.error || !cohortResult.data) {
    return { ok: false, error: databaseMessage(cohortResult.error, "The cohort was not saved. Try again.") };
  }

  const cohortId = cohortResult.data.id;

  const { error: deleteError } = await supabase.from("cohort_breaks").delete().eq("cohort_id", cohortId);
  if (deleteError) {
    return { ok: false, error: "The cohort breaks could not be updated. Try again." };
  }

  if (breaks.length > 0) {
    const { error: insertError } = await supabase.from("cohort_breaks").insert(
      breaks.map((row) => ({
        cohort_id: cohortId,
        start_date: row.startDate,
        weeks: row.weeks,
        label: row.label,
      })),
    );
    if (insertError) {
      return { ok: false, error: databaseMessage(insertError, "The cohort breaks could not be saved. Try again.") };
    }
  }

  revalidatePath("/trainer/users");
  revalidatePath("/my-path");
  return { ok: true, data: { id: cohortId } };
}
