"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { authorise } from "@/lib/auth";
import { databaseMessage, notAllowed, type ActionResult } from "@/lib/actions/result";
import { specialistPathwayValues, streamValues } from "@/lib/people/labels";
import { createClient } from "@/lib/supabase/server";

const trainersAndAdmins = ["trainer", "admin"] as const;

const optionalReason = z
  .string()
  .trim()
  .max(500, { error: "Keep the reason under 500 characters." })
  .optional()
  .transform((value) => value || undefined);

const updatePeopleInput = z.strictObject({
  userIds: z.array(z.uuid()).min(1, { error: "Choose at least one person." }).max(500),
  departmentId: z.uuid().optional(),
  stream: z.enum(streamValues).optional(),
  pathway: z.enum(specialistPathwayValues).optional(),
  cohortId: z.uuid().optional(),
  isActive: z.boolean().optional(),
  clear: z.array(z.enum(["department", "stream", "specialist_pathway", "cohort"])).default([]),
  reason: optionalReason,
});

export type UpdatePeopleInput = z.input<typeof updatePeopleInput>;

/** Department, stream, pathway, cohort and active status, for one person or many. Never role or scope. */
export async function updatePeople(input: UpdatePeopleInput): Promise<ActionResult<{ updated: number }>> {
  if (!(await authorise(trainersAndAdmins))) {
    return { ok: false, error: notAllowed };
  }
  const parsed = updatePeopleInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  }
  const value = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("trainer_update_profiles", {
    user_ids: value.userIds,
    department_id: value.departmentId,
    stream: value.stream,
    specialist_pathway: value.pathway,
    cohort_id: value.cohortId,
    is_active: value.isActive,
    reason: value.reason,
    clear_fields: value.clear,
  });
  if (error) {
    return { ok: false, error: databaseMessage(error, "The change was not saved. Try again.") };
  }
  revalidatePath("/", "layout");
  return { ok: true, data: { updated: data } };
}

const cohortInput = z.strictObject({
  id: z.uuid().optional(),
  name: z
    .string()
    .trim()
    .min(1, { error: "Give the cohort a name." })
    .max(100, { error: "Keep the name under 100 characters." }),
  startDate: z
    .union([z.iso.date({ error: "Enter the start date as a date." }), z.literal("")])
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
});

export type CohortInput = z.input<typeof cohortInput>;

/** Creates a cohort, or edits one when an id is given. */
export async function saveCohort(input: CohortInput): Promise<ActionResult<{ id: string }>> {
  if (!(await authorise(trainersAndAdmins))) {
    return { ok: false, error: notAllowed };
  }
  const parsed = cohortInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  }
  const { id, name, startDate, slot, notes } = parsed.data;
  const fields = { name, start_date: startDate, slot, notes };

  const supabase = await createClient();
  const result = id
    ? await supabase.from("cohorts").update(fields).eq("id", id).select("id").maybeSingle()
    : await supabase.from("cohorts").insert(fields).select("id").single();

  if (result.error?.code === "23505") {
    return { ok: false, error: "Another cohort already has that name. Choose a different name." };
  }
  if (result.error || !result.data) {
    return { ok: false, error: "The cohort was not saved. Try again." };
  }
  revalidatePath("/trainer/users");
  return { ok: true, data: { id: result.data.id } };
}

const cohortId = z.uuid({ error: "That cohort was not found." });

/** Archived cohorts keep their people but cannot take new ones. */
export async function setCohortArchived(id: string, archived: boolean): Promise<ActionResult> {
  if (!(await authorise(trainersAndAdmins))) {
    return { ok: false, error: notAllowed };
  }
  const parsedId = cohortId.safeParse(id);
  if (!parsedId.success || typeof archived !== "boolean") {
    return { ok: false, error: "That cohort was not found." };
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cohorts")
    .update({ is_archived: archived })
    .eq("id", parsedId.data)
    .select("id")
    .maybeSingle();
  if (error || !data) {
    return { ok: false, error: "The cohort was not changed. Try again." };
  }
  revalidatePath("/trainer/users");
  return { ok: true, data: null };
}

/** Only a cohort nobody is in can be deleted; the database refuses otherwise. */
export async function deleteCohort(id: string): Promise<ActionResult> {
  if (!(await authorise(trainersAndAdmins))) {
    return { ok: false, error: notAllowed };
  }
  const parsedId = cohortId.safeParse(id);
  if (!parsedId.success) {
    return { ok: false, error: "That cohort was not found." };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.from("cohorts").delete().eq("id", parsedId.data).select("id");
  if (error?.code === "23503") {
    return { ok: false, error: "People are in this cohort, so it cannot be deleted. Archive it instead." };
  }
  if (error || !data?.length) {
    return { ok: false, error: "The cohort was not deleted. Try again." };
  }
  revalidatePath("/trainer/users");
  return { ok: true, data: null };
}
