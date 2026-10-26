/**
 * Read-only comparison of RLS flags and policy names between dev and production databases.
 *
 *   npx tsx scripts/compare-rls-policies.ts
 *
 * Requires SUPABASE_DB_URL, DEV_PROJECT_REF, SUPABASE_PROD_DB_URL, SUPABASE_PROD_PROJECT_REF.
 * Prints the prod ref and requires typing it back.
 */
import { resolve } from "node:path";
import { Client } from "pg";
import { assertDevProjectRef } from "./demo-data-guard";
import { confirmProductionRef, readProdProjectRefFromEnv } from "./prod-ref-guard";

function loadEnv() {
  try {
    process.loadEnvFile(resolve(".env.local"));
  } catch {
    // Shell may export variables.
  }
}

type PolicyRow = {
  tablename: string;
  rls_enabled: boolean;
  policyname: string;
};

async function fetchPolicies(client: Client): Promise<PolicyRow[]> {
  const { rows } = await client.query<PolicyRow>(`
    select
      c.relname as tablename,
      c.relrowsecurity as rls_enabled,
      p.polname as policyname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    left join pg_policy p on p.polrelid = c.oid
    where n.nspname = 'public'
      and c.relkind = 'r'
    order by c.relname, p.polname nulls first
  `);
  return rows;
}

function summarise(rows: PolicyRow[]) {
  const map = new Map<string, { rls: boolean; policies: string[] }>();
  for (const row of rows) {
    const entry = map.get(row.tablename) ?? { rls: row.rls_enabled, policies: [] };
    entry.rls = row.rls_enabled;
    if (row.policyname) {
      entry.policies.push(row.policyname);
    }
    map.set(row.tablename, entry);
  }
  return map;
}

async function main() {
  loadEnv();
  const devUrl = process.env.SUPABASE_DB_URL?.trim();
  const devRef = process.env.DEV_PROJECT_REF?.trim();
  if (!devUrl || !devRef) {
    console.error("SUPABASE_DB_URL and DEV_PROJECT_REF are required.");
    process.exit(1);
  }
  const devGuard = assertDevProjectRef(devUrl, devRef);
  if (!devGuard.ok) {
    console.error(devGuard.message);
    process.exit(1);
  }

  const prodRef = readProdProjectRefFromEnv();
  const prodUrl = process.env.SUPABASE_PROD_DB_URL?.trim();
  if (!prodUrl) {
    console.error("SUPABASE_PROD_DB_URL is required in .env.local.");
    process.exit(1);
  }
  await confirmProductionRef(prodRef);

  const devClient = new Client({ connectionString: devUrl, ssl: { rejectUnauthorized: false } });
  const prodClient = new Client({ connectionString: prodUrl, ssl: { rejectUnauthorized: false } });
  await devClient.connect();
  await prodClient.connect();

  const devMap = summarise(await fetchPolicies(devClient));
  const prodMap = summarise(await fetchPolicies(prodClient));

  await devClient.end();
  await prodClient.end();

  const allTables = new Set([...devMap.keys(), ...prodMap.keys()]);
  let diffs = 0;

  console.log(`Comparing RLS policies: dev (${devRef}) vs prod (${prodRef})\n`);

  for (const table of [...allTables].sort()) {
    const dev = devMap.get(table);
    const prod = prodMap.get(table);
    if (!dev || !prod) {
      diffs += 1;
      console.log(`DIFF  ${table}: missing on ${!dev ? "dev" : "prod"}`);
      continue;
    }
    const devPolicies = [...dev.policies].sort().join(",");
    const prodPolicies = [...prod.policies].sort().join(",");
    if (dev.rls !== prod.rls || devPolicies !== prodPolicies) {
      diffs += 1;
      console.log(`DIFF  ${table}`);
      console.log(`       dev  rls=${dev.rls} policies=[${devPolicies}]`);
      console.log(`       prod rls=${prod.rls} policies=[${prodPolicies}]`);
    }
  }

  console.log("");
  if (diffs > 0) {
    console.error(`${diffs} table(s) differ.`);
    process.exit(1);
  }
  console.log("RLS and policy names match on all public tables.");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "compare failed.");
  process.exit(1);
});
