/**
 * Writes docs/security/ACCESS_MATRIX.md from tests/rls/fixtures/access-matrix-cases.ts
 *
 *   npx tsx scripts/generate-access-matrix.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { accessMatrixCases } from "../tests/rls/fixtures/access-matrix-cases";

const lines = [
  "# Access matrix (generated)",
  "",
  "Generated from `tests/rls/fixtures/access-matrix-cases.ts`. Run `npx tsx scripts/generate-access-matrix.ts` after edits.",
  "",
  "| Persona | Operation | Target | Expected | Test |",
  "|---|---|---|---|---|",
];

for (const row of accessMatrixCases) {
  const testName = `${row.persona} ${row.operation} on ${row.target}`;
  lines.push(`| ${row.persona} | ${row.operation} | ${row.target} | ${row.expect} | \`${testName}\` |`);
}

lines.push("");
mkdirSync(resolve("docs/security"), { recursive: true });
writeFileSync(resolve("docs/security/ACCESS_MATRIX.md"), lines.join("\n"));
console.log("Wrote docs/security/ACCESS_MATRIX.md");
