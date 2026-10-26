/**
 * Development: curriculum row counts (same as db:check).
 * Production: read-only sanity counts (requires typing prod ref).
 *
 *   npm run db:check:dev
 *   npm run db:check:prod
 */
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import {
  assertProdUrlMatchesRef,
  confirmProductionRef,
  readProdProjectRefFromEnv,
} from "./prod-ref-guard";

function loadEnv() {
  try {
    process.loadEnvFile(resolve(".env.local"));
  } catch {
    // Shell may export variables.
  }
}

async function checkProd() {
  const prodRef = readProdProjectRefFromEnv();
  const url = process.env.SUPABASE_PROD_URL?.trim();
  const secret = process.env.SUPABASE_PROD_SECRET_KEY?.trim();
  if (!url || !secret) {
    console.error("SUPABASE_PROD_URL and SUPABASE_PROD_SECRET_KEY are required in .env.local.");
    process.exit(1);
  }
  assertProdUrlMatchesRef(url, prodRef);
  await confirmProductionRef(prodRef);

  const supabase = createClient(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  console.log(`Read-only production checks on ref ${prodRef}\n`);

  const tables = [
    "profiles",
    "assessments",
    "assignments",
    "pages",
    "updates",
    "lessons",
    "audit_log",
  ] as const;

  for (const table of tables) {
    const { count, error } = await supabase.from(table).select("*", { count: "exact", head: true });
    if (error) {
      console.log(`FAIL  ${table.padEnd(20)} ${error.message}`);
      continue;
    }
    console.log(`      ${table.padEnd(20)} ${String(count ?? 0).padStart(6)} rows`);
  }

  const { count: sampleAssessments } = await supabase
    .from("assessments")
    .select("*", { count: "exact", head: true })
    .eq("is_sample", true);
  const { count: sampleAssignments } = await supabase
    .from("assignments")
    .select("*", { count: "exact", head: true })
    .eq("is_sample", true);
  const { count: testProfiles } = await supabase
    .from("profiles")
    .select("*", { count: "exact", head: true })
    .eq("is_test_account", true);

  console.log("");
  const failures: string[] = [];
  if ((sampleAssessments ?? 0) > 0) {
    failures.push(`sample assessments: ${sampleAssessments}`);
  }
  if ((sampleAssignments ?? 0) > 0) {
    failures.push(`sample assignments: ${sampleAssignments}`);
  }
  if ((testProfiles ?? 0) > 0) {
    failures.push(`test profiles: ${testProfiles}`);
  }

  if (failures.length > 0) {
    console.error(`Production sanity failed: ${failures.join("; ")}`);
    process.exit(1);
  }
  console.log("Production sanity OK (no sample assessments/assignments or test profiles).");
}

async function main() {
  loadEnv();
  const mode = process.argv[2];
  if (mode === "dev") {
    const ref = process.env.DEV_PROJECT_REF?.trim();
    if (ref) {
      console.log(`Development database ref: ${ref}\n`);
    }
    const result = spawnSync("npx", ["tsx", "scripts/db-check.ts"], { stdio: "inherit" });
    process.exit(result.status ?? 0);
  }
  if (mode === "prod") {
    await checkProd();
    return;
  }
  console.error("Usage: tsx scripts/db-check-env.ts dev|prod");
  process.exit(1);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "db check failed.");
  process.exit(1);
});
