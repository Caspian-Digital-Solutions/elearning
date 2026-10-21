/**
 * Idempotently ensures fixed Test Learner / Test Trainer accounts for screenshots and E2E.
 * Uses the Supabase Admin API (bypasses RLS). Never deletes these users mid-run.
 *
 * Run: npx tsx scripts/ensure-test-accounts.ts
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/lib/types/database";

const ACCOUNTS = [
  {
    email: "test-learner-screenshots@caspiands.com",
    fullName: "Test Learner",
    role: "learner" as const,
  },
  {
    email: "test-trainer-screenshots@caspiands.com",
    fullName: "Test Trainer",
    role: "trainer" as const,
  },
];

function loadEnv() {
  const text = readFileSync(resolve(".env.local"), "utf8");
  const env: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) {
      env[m[1]] = m[2];
    }
  }
  return env;
}

async function main() {
  const env = loadEnv();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = env.SUPABASE_SECRET_KEY;
  if (!url || !secret) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY are required in .env.local");
  }

  const admin = createClient<Database>(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: dept } = await admin.from("departments").select("id").eq("code", "content").maybeSingle();
  if (!dept) {
    throw new Error("Content department not found — run curriculum seed first.");
  }

  for (const account of ACCOUNTS) {
    const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const existing = list?.users.find((u) => u.email?.toLowerCase() === account.email.toLowerCase());
    let userId = existing?.id;

    if (!userId) {
      const { data: created, error } = await admin.auth.admin.createUser({
        email: account.email,
        email_confirm: true,
        user_metadata: { full_name: account.fullName },
      });
      if (error || !created.user) {
        throw error ?? new Error(`Could not create ${account.email}`);
      }
      userId = created.user.id;
      console.log(`Created auth user ${account.email}`);
    } else {
      console.log(`Auth user already exists: ${account.email}`);
    }

    const { error: profileError } = await admin
      .from("profiles")
      .update({
        full_name: account.fullName,
        role: account.role,
        department_id: dept.id,
        is_test_account: true,
        is_active: true,
        progress_scope: "self",
      })
      .eq("id", userId);

    if (profileError) {
      throw profileError;
    }
    console.log(`Updated profile for ${account.email} (is_test_account=true, role=${account.role})`);
  }

  console.log("Done. These accounts are excluded from trainer user counts and placement lists.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
