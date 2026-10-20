import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { expectedCounts, parseCurriculum } from "./seed/build-seed-sql";

/**
 * Prints row counts for the seeded tables and exits with an error if any is wrong.
 * Uses the secret key because nobody can sign in yet (Prompt 03), so a normal
 * signed-in read would see nothing through RLS. Values from .env.local are never printed.
 */

function loadEnvFile() {
  try {
    process.loadEnvFile(resolve(".env.local"));
  } catch {
    // Variables may already be set in the shell; the check below names any that are missing.
  }
}

function requireVariable(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    console.error(`${name} is missing. Add it to .env.local (see .env.example).`);
    process.exit(1);
  }
  return value;
}

async function main() {
  loadEnvFile();
  const url = requireVariable("NEXT_PUBLIC_SUPABASE_URL");
  const secretKey = requireVariable("SUPABASE_SECRET_KEY");

  const curriculum = parseCurriculum(
    JSON.parse(readFileSync(resolve("docs/seed/curriculum_v1_1.json"), "utf8")),
  );
  const expected = expectedCounts(curriculum);

  const supabase = createClient(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  let failures = 0;
  console.log(`Checking ${new URL(url).host}\n`);

  for (const [table, want] of Object.entries(expected)) {
    const { count, error } = await supabase.from(table).select("*", { count: "exact", head: true });
    if (error) {
      failures += 1;
      console.log(`FAIL  ${table.padEnd(32)} could not count rows: ${error.message}`);
      continue;
    }
    const ok = count === want;
    if (!ok) failures += 1;
    console.log(`${ok ? "OK  " : "FAIL"}  ${table.padEnd(32)} ${String(count).padStart(3)} (expected ${want})`);
  }

  const inactiveWanted = curriculum.departments.filter((d) => !d.is_active).map((d) => d.code).sort();
  const { data: inactive, error: inactiveError } = await supabase
    .from("departments")
    .select("code")
    .eq("is_active", false)
    .order("code");
  const inactiveFound = (inactive ?? []).map((d) => d.code);
  const inactiveOk = !inactiveError && inactiveFound.join(",") === inactiveWanted.join(",");
  if (!inactiveOk) failures += 1;
  console.log(
    `${inactiveOk ? "OK  " : "FAIL"}  ${"inactive departments".padEnd(32)} ${inactiveFound.join(", ") || "none"} (expected ${inactiveWanted.join(", ")})`,
  );

  console.log("");
  if (failures > 0) {
    console.error(`${failures} check(s) failed.`);
    process.exit(1);
  }
  console.log("All counts match the curriculum.");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "The database check failed.");
  process.exit(1);
});
