/**
 * Exports all public tables to dated CSV files (development only).
 *
 *   npx tsx scripts/export-snapshot.ts
 */
import { createWriteStream, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { Client } from "pg";
import { assertDevProjectRef, assertNotProductionAppEnv } from "./demo-data-guard";

function loadEnv() {
  try {
    process.loadEnvFile(resolve(".env.local"));
  } catch {
    // Shell may export variables.
  }
}

function csvEscape(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}

async function main() {
  loadEnv();
  const prodGuard = assertNotProductionAppEnv();
  if (!prodGuard.ok) {
    console.error(prodGuard.message);
    process.exit(1);
  }
  const url = process.env.SUPABASE_DB_URL?.trim();
  const devRef = process.env.DEV_PROJECT_REF?.trim();
  if (!url || !devRef) {
    console.error("SUPABASE_DB_URL and DEV_PROJECT_REF are required in .env.local.");
    process.exit(1);
  }
  const guard = assertDevProjectRef(url, devRef);
  if (!guard.ok) {
    console.error(guard.message);
    process.exit(1);
  }

  const date = new Date().toISOString().slice(0, 10);
  const outDir = resolve(`snapshots/${date}`);
  mkdirSync(outDir, { recursive: true });

  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await client.connect();
  const tables = await client.query<{ tablename: string }>(
    `select tablename from pg_tables where schemaname = 'public' order by tablename`,
  );
  for (const row of tables.rows) {
    const name = row.tablename;
    const { rows: data, fields } = await client.query(`select * from public.${name}`);
    const headers = fields.map((field) => field.name);
    const file = createWriteStream(resolve(outDir, `${name}.csv`));
    file.write(`${headers.join(",")}\n`);
    for (const record of data) {
      file.write(`${headers.map((key) => csvEscape((record as Record<string, unknown>)[key])).join(",")}\n`);
    }
    file.end();
    console.log(`Wrote ${name}.csv (${data.length} rows)`);
  }
  await client.end();
  console.log(`Snapshot complete: ${outDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
