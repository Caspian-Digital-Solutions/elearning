/**
 * Development-only demo learners for /progress checks.
 *
 *   npm run demo:seed
 *   npm run demo:clear
 *
 * Refuses to run unless NEXT_PUBLIC_SUPABASE_URL matches DEV_PROJECT_REF in .env.local.
 */
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/lib/types/database";
import { assertDevProjectRef, projectRefFromSupabaseUrl, readYesFromArgv } from "./demo-data-guard";

const DEMO_COHORT_NAME = "Demo cohort (Prompt 10)";
const DEMO_EMAIL_DOMAIN = "caspiands.com";

function loadEnvFile() {
  try {
    process.loadEnvFile(resolve(".env.local"));
  } catch {
    // Shell may already export variables.
  }
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    console.error(`${name} is missing. Add it to .env.local (see .env.example).`);
    process.exit(1);
  }
  return value;
}

async function confirm(projectRef: string, action: "seed" | "clear"): Promise<boolean> {
  if (readYesFromArgv(process.argv)) {
    return true;
  }
  const rl = createInterface({ input, output });
  const answer = await rl.question(
    `About to ${action} demo data on Supabase project ${projectRef}. Type yes to continue: `,
  );
  rl.close();
  return answer.trim().toLowerCase() === "yes";
}

async function clearDemoUsers(admin: ReturnType<typeof createClient<Database>>) {
  const { data: profiles, error } = await admin.from("profiles").select("id, email").eq("is_test_account", true);
  if (error) {
    throw error;
  }
  const ids = (profiles ?? []).map((row) => row.id);
  if (ids.length === 0) {
    console.log("No demo people to remove.");
    return;
  }
  const { error: deleteProfilesError } = await admin.from("profiles").delete().in("id", ids);
  if (deleteProfilesError) {
    throw deleteProfilesError;
  }
  for (const id of ids) {
    await admin.auth.admin.deleteUser(id);
  }
  console.log(`Removed ${ids.length} demo people and linked rows (cascade).`);
}

async function seedDemo(admin: ReturnType<typeof createClient<Database>>) {
  const { data: existingCohort } = await admin
    .from("cohorts")
    .select("id")
    .eq("name", DEMO_COHORT_NAME)
    .maybeSingle();
  let cohortId = existingCohort?.id;
  if (!cohortId) {
    const week0 = new Date();
    week0.setDate(week0.getDate() - 28);
    const week0Start = week0.toISOString().slice(0, 10);
    const { data: created, error } = await admin
      .from("cohorts")
      .insert({
        name: DEMO_COHORT_NAME,
        start_date: week0Start,
        week0_start_date: week0Start,
      })
      .select("id")
      .single();
    if (error) {
      throw error;
    }
    cohortId = created.id;
    console.log(`Created cohort ${DEMO_COHORT_NAME} (Week 0 = ${week0Start}).`);
  }

  const { data: deptRows } = await admin.from("departments").select("id, code");
  const deptByCode = new Map((deptRows ?? []).map((row) => [row.code, row.id]));

  type Spec = {
    name: string;
    dept: string;
    stream: Database["public"]["Enums"]["stream_type"];
    role: Database["public"]["Enums"]["app_role"];
    scope?: Database["public"]["Enums"]["progress_scope_type"];
  };

  const specs: Spec[] = [
    { name: "Demo Content 1", dept: "content", stream: "foundation", role: "learner" },
    { name: "Demo Creative 2", dept: "creative", stream: "practitioner", role: "learner" },
    { name: "Demo SEO 3", dept: "performance-seo", stream: "practitioner_fast_track", role: "champion" },
    { name: "Demo Paid 4", dept: "performance-paid", stream: "practitioner", role: "learner" },
    { name: "Demo Analytics 5", dept: "performance-analytics", stream: "foundation", role: "learner" },
    { name: "Demo AM 6", dept: "account-management", stream: "practitioner", role: "learner" },
    { name: "Demo SM 7", dept: "senior-management", stream: "champion", role: "manager", scope: "department" },
    { name: "Demo Content 8", dept: "content", stream: "practitioner", role: "learner" },
    { name: "Demo Creative 9", dept: "creative", stream: "foundation", role: "learner" },
    { name: "Demo SEO 10", dept: "performance-seo", stream: "practitioner", role: "learner" },
    { name: "Demo Paid 11", dept: "performance-paid", stream: "practitioner_fast_track", role: "learner" },
    { name: "Demo Analytics 12", dept: "performance-analytics", stream: "practitioner", role: "learner" },
  ];

  for (const [index, spec] of specs.entries()) {
    const slug = spec.name.toLowerCase().replaceAll(" ", "-");
    const email = `demo.${slug}@${DEMO_EMAIL_DOMAIN}`;
    const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const existing = list?.users.find((user) => user.email?.toLowerCase() === email);
    let userId = existing?.id;
    if (!userId) {
      const { data: created, error } = await admin.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: { full_name: spec.name },
      });
      if (error || !created.user) {
        throw error ?? new Error(`Could not create ${email}`);
      }
      userId = created.user.id;
    }
    const departmentId = deptByCode.get(spec.dept);
    if (!departmentId) {
      throw new Error(`Department ${spec.dept} not found.`);
    }
    const { error: profileError } = await admin
      .from("profiles")
      .update({
        full_name: spec.name,
        department_id: departmentId,
        cohort_id: cohortId,
        stream: spec.stream,
        role: spec.role,
        progress_scope: spec.scope ?? "self",
        is_test_account: true,
        is_active: true,
      })
      .eq("id", userId);
    if (profileError) {
      throw profileError;
    }
    const { error: planError } = await admin.rpc("generate_learner_plan", { p_user_id: userId });
    if (planError && index > 0) {
      console.warn(`Plan for ${spec.name}: ${planError.message}`);
    }
    console.log(`Upserted ${spec.name}`);
  }
  console.log("Demo seed finished. Tick Include test accounts on Progress › People.");
}

async function main() {
  loadEnvFile();
  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const secret = requireEnv("SUPABASE_SECRET_KEY");
  const devRef = requireEnv("DEV_PROJECT_REF");
  const guard = assertDevProjectRef(url, devRef);
  if (!guard.ok) {
    console.error(guard.message);
    process.exit(1);
  }
  const command = process.argv[2];
  if (command !== "seed" && command !== "clear") {
    console.error("Usage: tsx scripts/demo-data.ts <seed|clear> [--yes]");
    process.exit(1);
  }
  const ref = projectRefFromSupabaseUrl(url) ?? devRef;
  if (!(await confirm(ref, command))) {
    console.log("Cancelled.");
    process.exit(0);
  }

  const admin = createClient<Database>(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  if (command === "clear") {
    await clearDemoUsers(admin);
  } else {
    await seedDemo(admin);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
