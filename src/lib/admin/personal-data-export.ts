import "server-only";

import { zipSync, strToU8 } from "fflate";
import { createClient } from "@/lib/supabase/server";

function csvEscape(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}

function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) {
    return "";
  }
  const keys = Object.keys(rows[0]);
  const lines = [keys.join(",")];
  for (const row of rows) {
    lines.push(keys.map((key) => csvEscape(row[key])).join(","));
  }
  return lines.join("\n");
}

export async function buildPersonalDataZip(userId: string): Promise<Uint8Array> {
  const supabase = await createClient();

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
  const { data: plan } = await supabase.from("learner_plan").select("*").eq("user_id", userId);
  const { data: attempts } = await supabase.from("attempts").select("*").eq("user_id", userId);
  const { data: submissions } = await supabase.from("submissions").select("*").eq("user_id", userId);
  const { data: lessonProgress } = await supabase.from("lesson_progress").select("*").eq("user_id", userId);
  const { data: acknowledgements } = await supabase
    .from("page_acknowledgements")
    .select("*")
    .eq("user_id", userId);

  const attemptIds = (attempts ?? []).map((row) => row.id);
  const { data: responses } = attemptIds.length
    ? await supabase.from("responses").select("*").in("attempt_id", attemptIds)
    : { data: [] };

  const submissionFiles = (submissions ?? []).map((row) => ({
    submission_id: row.id,
    assignment_id: row.assignment_id,
    file_path: row.file_path,
    status: row.status,
    submitted_at: row.submitted_at,
  }));

  const files: Record<string, Uint8Array> = {
    "profile.csv": strToU8(toCsv(profile ? [profile] : [])),
    "learner_plan.csv": strToU8(toCsv(plan ?? [])),
    "attempts.csv": strToU8(toCsv(attempts ?? [])),
    "responses.csv": strToU8(toCsv(responses ?? [])),
    "submissions.csv": strToU8(toCsv(submissions ?? [])),
    "submission_files_list.csv": strToU8(toCsv(submissionFiles)),
    "lesson_progress.csv": strToU8(toCsv(lessonProgress ?? [])),
    "page_acknowledgements.csv": strToU8(toCsv(acknowledgements ?? [])),
    "readme.txt": strToU8(
      "Personal data export. Submission files are listed in submission_files_list.csv; download files separately through admin storage tools if needed.\n",
    ),
  };

  return zipSync(files);
}
