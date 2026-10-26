/**
 * One-time cut-over copy from development to production (non-sample content only).
 *
 *   npx tsx scripts/promote-content.ts --dry-run
 *   npx tsx scripts/promote-content.ts
 *   npx tsx scripts/promote-content.ts --force --reason "..."  (second run)
 */
import { resolve } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../src/lib/types/database";
import { assertDevProjectRef, assertNotProductionAppEnv } from "./demo-data-guard";
import {
  assertProdUrlMatchesRef,
  confirmProductionRef,
  confirmYesPhrase,
  readProdProjectRefFromEnv,
} from "./prod-ref-guard";

const PROMOTION_SETTING_KEY = "ops.content_promoted_at";

function loadEnv() {
  try {
    process.loadEnvFile(resolve(".env.local"));
  } catch {
    // Shell may export variables.
  }
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    console.error(`${name} is missing. See .env.example.`);
    process.exit(1);
  }
  return value;
}

function parseArgs(argv: string[]) {
  const dryRun = argv.includes("--dry-run");
  const force = argv.includes("--force");
  const reasonIndex = argv.indexOf("--reason");
  const reason = reasonIndex >= 0 ? argv[reasonIndex + 1]?.trim() : undefined;
  return { dryRun, force, reason };
}

async function loadTestAccountIds(dev: SupabaseClient<Database>): Promise<Set<string>> {
  const { data, error } = await dev.from("profiles").select("id").eq("is_test_account", true);
  if (error) {
    throw new Error(`Could not load test accounts: ${error.message}`);
  }
  return new Set((data ?? []).map((row) => row.id));
}

function ownedByTest(
  row: { published_by?: string | null; owner_id?: string | null },
  testIds: Set<string>,
): boolean {
  const author = row.published_by ?? row.owner_id;
  return author ? testIds.has(author) : false;
}

async function promotionAlreadyDone(prod: SupabaseClient<Database>): Promise<boolean> {
  const { data } = await prod.from("app_settings").select("value").eq("key", PROMOTION_SETTING_KEY).maybeSingle();
  return Boolean(data?.value);
}

async function printSummary(dev: SupabaseClient<Database>, testIds: Set<string>) {
  const sections: { label: string; count: number; samples: string[] }[] = [];

  const { data: pages } = await dev.from("pages").select("slug, title, published_by, owner_id");
  const pageRows = (pages ?? []).filter((row) => !ownedByTest(row, testIds));
  sections.push({
    label: "help pages",
    count: pageRows.length,
    samples: pageRows.slice(0, 8).map((row) => row.title),
  });

  const { data: updates } = await dev.from("updates").select("title, published_by");
  const updateRows = (updates ?? []).filter((row) => !ownedByTest(row, testIds));
  sections.push({
    label: "what changed notes",
    count: updateRows.length,
    samples: updateRows.slice(0, 8).map((row) => row.title),
  });

  const { data: modules } = await dev
    .from("modules")
    .select("code, title")
    .neq("overview_md", "");
  sections.push({
    label: "module overviews",
    count: modules?.length ?? 0,
    samples: (modules ?? []).slice(0, 8).map((row) => row.code),
  });

  const { data: lessons } = await dev.from("lessons").select("title, module_id");
  sections.push({
    label: "lessons",
    count: lessons?.length ?? 0,
    samples: (lessons ?? []).slice(0, 8).map((row) => row.title),
  });

  const { data: rubrics } = await dev.from("rubrics").select("ref, title");
  sections.push({
    label: "rubrics",
    count: rubrics?.length ?? 0,
    samples: (rubrics ?? []).slice(0, 8).map((row) => row.ref),
  });

  const { data: assessments } = await dev
    .from("assessments")
    .select("code, title")
    .eq("is_sample", false);
  sections.push({
    label: "assessments (non-sample)",
    count: assessments?.length ?? 0,
    samples: (assessments ?? []).slice(0, 8).map((row) => row.code),
  });

  const { data: assignments } = await dev
    .from("assignments")
    .select("code, title")
    .eq("is_sample", false);
  sections.push({
    label: "assignments (non-sample)",
    count: assignments?.length ?? 0,
    samples: (assignments ?? []).slice(0, 8).map((row) => row.code),
  });

  console.log("Would copy from development to production:\n");
  for (const section of sections) {
    console.log(`  ${section.label}: ${section.count}`);
    if (section.samples.length) {
      console.log(`    e.g. ${section.samples.join(", ")}`);
    }
  }
  console.log("");
}

async function copyPages(
  dev: SupabaseClient<Database>,
  prod: SupabaseClient<Database>,
  testIds: Set<string>,
) {
  const { data, error } = await dev.from("pages").select("*");
  if (error) throw new Error(error.message);
  const rows = (data ?? []).filter((row) => !ownedByTest(row, testIds));
  if (!rows.length) return;
  const { error: upsertError } = await prod.from("pages").upsert(rows, { onConflict: "slug" });
  if (upsertError) throw new Error(upsertError.message);
}

async function copyUpdates(
  dev: SupabaseClient<Database>,
  prod: SupabaseClient<Database>,
  testIds: Set<string>,
) {
  const { data, error } = await dev.from("updates").select("*");
  if (error) throw new Error(error.message);
  const rows = (data ?? []).filter((row) => !ownedByTest(row, testIds));
  if (!rows.length) return;
  const { error: upsertError } = await prod.from("updates").upsert(rows, { onConflict: "id" });
  if (upsertError) throw new Error(upsertError.message);
}

async function buildModuleIdMap(
  dev: SupabaseClient<Database>,
  prod: SupabaseClient<Database>,
): Promise<Map<string, string>> {
  const { data: devMods, error: devError } = await dev.from("modules").select("id, code");
  if (devError) throw new Error(devError.message);
  const { data: prodMods, error: prodError } = await prod.from("modules").select("id, code");
  if (prodError) throw new Error(prodError.message);
  const prodByCode = new Map((prodMods ?? []).map((row) => [row.code, row.id]));
  const map = new Map<string, string>();
  for (const row of devMods ?? []) {
    const prodId = prodByCode.get(row.code);
    if (prodId) map.set(row.id, prodId);
  }
  return map;
}

async function copyLessons(
  dev: SupabaseClient<Database>,
  prod: SupabaseClient<Database>,
  moduleMap: Map<string, string>,
) {
  const { data, error } = await dev.from("lessons").select("*");
  if (error) throw new Error(error.message);
  const rows = (data ?? [])
    .map((row) => {
      const moduleId = moduleMap.get(row.module_id);
      if (!moduleId) return null;
      return { ...row, module_id: moduleId };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);
  if (!rows.length) return;
  const { error: upsertError } = await prod.from("lessons").upsert(rows, { onConflict: "id" });
  if (upsertError) throw new Error(upsertError.message);
}

async function copyRubrics(dev: SupabaseClient<Database>, prod: SupabaseClient<Database>) {
  const { data: rubrics, error } = await dev.from("rubrics").select("*");
  if (error) throw new Error(error.message);
  if (!rubrics?.length) return;
  const { error: rubricError } = await prod.from("rubrics").upsert(rubrics, { onConflict: "ref" });
  if (rubricError) throw new Error(rubricError.message);

  const rubricIds = rubrics.map((row) => row.id);
  const { data: criteria, error: criteriaError } = await dev
    .from("rubric_criteria")
    .select("*")
    .in("rubric_id", rubricIds);
  if (criteriaError) throw new Error(criteriaError.message);
  if (criteria?.length) {
    const { error: upsertCriteria } = await prod
      .from("rubric_criteria")
      .upsert(criteria, { onConflict: "id" });
    if (upsertCriteria) throw new Error(upsertCriteria.message);
    const criterionIds = criteria.map((row) => row.id);
    const { data: levels, error: levelsError } = await dev
      .from("rubric_levels")
      .select("*")
      .in("criterion_id", criterionIds);
    if (levelsError) throw new Error(levelsError.message);
    if (levels?.length) {
      const { error: upsertLevels } = await prod
        .from("rubric_levels")
        .upsert(levels, { onConflict: "id" });
      if (upsertLevels) throw new Error(upsertLevels.message);
    }
  }
}

async function copyAssessments(dev: SupabaseClient<Database>, prod: SupabaseClient<Database>) {
  const { data, error } = await dev.from("assessments").select("*").eq("is_sample", false);
  if (error) throw new Error(error.message);
  if (!data?.length) return;
  const { error: upsertError } = await prod.from("assessments").upsert(data, { onConflict: "code" });
  if (upsertError) throw new Error(upsertError.message);
}

async function copyAssignments(
  dev: SupabaseClient<Database>,
  prod: SupabaseClient<Database>,
  moduleMap: Map<string, string>,
) {
  const { data, error } = await dev.from("assignments").select("*").eq("is_sample", false);
  if (error) throw new Error(error.message);
  const rows = (data ?? [])
    .map((row) => {
      const moduleId = moduleMap.get(row.module_id);
      if (!moduleId) return null;
      return { ...row, module_id: moduleId };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);
  if (!rows.length) return;
  const { error: upsertError } = await prod.from("assignments").upsert(rows, { onConflict: "code" });
  if (upsertError) throw new Error(upsertError.message);
}

async function copyModuleOverviews(dev: SupabaseClient<Database>, prod: SupabaseClient<Database>) {
  const { data, error } = await dev.from("modules").select("code, overview_md");
  if (error) throw new Error(error.message);
  for (const row of data ?? []) {
    if (!row.overview_md?.trim()) continue;
    const { error: updateError } = await prod
      .from("modules")
      .update({ overview_md: row.overview_md })
      .eq("code", row.code);
    if (updateError) throw new Error(updateError.message);
  }
}

async function markPromotionComplete(prod: SupabaseClient<Database>) {
  const stamp = new Date().toISOString();
  const { error } = await prod.from("app_settings").upsert({
    key: PROMOTION_SETTING_KEY,
    value: stamp,
    note: "Content promotion script completed (Prompt 11b).",
  });
  if (error) throw new Error(error.message);
}

async function main() {
  loadEnv();
  const prodGuard = assertNotProductionAppEnv();
  if (!prodGuard.ok) {
    console.error(prodGuard.message);
    process.exit(1);
  }

  const { dryRun, force, reason } = parseArgs(process.argv.slice(2));
  const devUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const devSecret = requireEnv("SUPABASE_SECRET_KEY");
  const devRef = requireEnv("DEV_PROJECT_REF");
  const devGuard = assertDevProjectRef(devUrl, devRef);
  if (!devGuard.ok) {
    console.error(devGuard.message);
    process.exit(1);
  }

  const prodRef = readProdProjectRefFromEnv();
  const prodUrl = requireEnv("SUPABASE_PROD_URL");
  const prodSecret = requireEnv("SUPABASE_PROD_SECRET_KEY");
  assertProdUrlMatchesRef(prodUrl, prodRef);

  const dev = createClient<Database>(devUrl, devSecret, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const prod = createClient<Database>(prodUrl, prodSecret, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const testIds = await loadTestAccountIds(dev);

  if (dryRun) {
    console.log(`Dry run — source dev ref ${devRef}, target prod ref ${prodRef}\n`);
    await printSummary(dev, testIds);
    return;
  }

  await confirmProductionRef(prodRef);

  if (await promotionAlreadyDone(prod)) {
    if (!force || !reason) {
      console.error(
        `Promotion already recorded (${PROMOTION_SETTING_KEY}). Use --force --reason "..." to run again.`,
      );
      process.exit(1);
    }
    console.log(`Forced re-run: ${reason}`);
  } else {
    await printSummary(dev, testIds);
    await confirmYesPhrase("yes");
  }

  const moduleMap = await buildModuleIdMap(dev, prod);
  await copyPages(dev, prod, testIds);
  await copyUpdates(dev, prod, testIds);
  await copyModuleOverviews(dev, prod);
  await copyLessons(dev, prod, moduleMap);
  await copyRubrics(dev, prod);
  await copyAssessments(dev, prod);
  await copyAssignments(dev, prod, moduleMap);
  await markPromotionComplete(prod);

  console.log("\nContent promotion finished. Review production in the dashboard.");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "promote-content failed.");
  process.exit(1);
});
