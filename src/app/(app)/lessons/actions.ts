"use server";

import { revalidatePath } from "next/cache";
import { authorise } from "@/lib/auth";
import { databaseMessage, notAllowed, type ActionResult } from "@/lib/actions/result";
import { createClient } from "@/lib/supabase/server";

export async function markLessonComplete(lessonId: string): Promise<ActionResult> {
  if (!(await authorise(["learner", "champion", "manager", "trainer", "admin"]))) {
    return { ok: false, error: notAllowed };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: notAllowed };
  }

  const { error } = await supabase.from("lesson_progress").insert({
    lesson_id: lessonId,
    user_id: user.id,
    completed_at: new Date().toISOString(),
  });
  if (error) {
    return { ok: false, error: databaseMessage(error, "Could not mark complete.") };
  }
  revalidatePath("/lessons", "layout");
  return { ok: true, data: null };
}

export async function unmarkLessonComplete(lessonId: string): Promise<ActionResult> {
  if (!(await authorise(["learner", "champion", "manager", "trainer", "admin"]))) {
    return { ok: false, error: notAllowed };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: notAllowed };
  }

  const { error } = await supabase
    .from("lesson_progress")
    .delete()
    .eq("lesson_id", lessonId)
    .eq("user_id", user.id);
  if (error) {
    return { ok: false, error: databaseMessage(error, "Could not remove completion.") };
  }
  revalidatePath("/lessons", "layout");
  return { ok: true, data: null };
}
