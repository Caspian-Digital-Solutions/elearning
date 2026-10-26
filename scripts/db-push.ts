/**
 * Push migrations to development or production Supabase.
 *
 *   npm run db:push:dev
 *   npm run db:push:prod   (prints prod ref and requires typing it back)
 */
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { projectRefFromSupabaseUrl } from "../src/lib/supabase/project-ref";
import { confirmProductionRef, readProdProjectRefFromEnv } from "./prod-ref-guard";

function loadEnv() {
  try {
    process.loadEnvFile(resolve(".env.local"));
  } catch {
    // Shell may export variables.
  }
}

function requireDevRef(): string {
  const devRef = process.env.DEV_PROJECT_REF?.trim();
  if (!devRef) {
    console.error("DEV_PROJECT_REF is missing in .env.local.");
    process.exit(1);
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (url) {
    const fromUrl = projectRefFromSupabaseUrl(url);
    if (fromUrl && fromUrl !== devRef) {
      console.error(
        `NEXT_PUBLIC_SUPABASE_URL ref (${fromUrl}) does not match DEV_PROJECT_REF (${devRef}).`,
      );
      process.exit(1);
    }
  }
  return devRef;
}

function runPush(ref: string, label: string) {
  console.log(`Pushing migrations to ${label} Supabase ref: ${ref}\n`);
  const result = spawnSync("npx", ["supabase", "db", "push", "--project-ref", ref], {
    stdio: "inherit",
    shell: false,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

async function main() {
  loadEnv();
  const mode = process.argv[2];
  if (mode === "dev") {
    const ref = requireDevRef();
    runPush(ref, "development");
    return;
  }
  if (mode === "prod") {
    const prodRef = readProdProjectRefFromEnv();
    await confirmProductionRef(prodRef);
    runPush(prodRef, "PRODUCTION");
    return;
  }
  console.error("Usage: tsx scripts/db-push.ts dev|prod");
  process.exit(1);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "db push failed.");
  process.exit(1);
});
