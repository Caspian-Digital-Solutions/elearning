import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Client } from "pg";
import type { AssessmentImportRubric } from "../src/lib/assessments/import";
import {
  parseAssignmentImportJson,
  validateAssignmentImport,
  type AssignmentImportFile,
} from "../src/lib/assignments/import";

export function loadDbUrl(): string {
  const text = readFileSync(resolve(".env.local"), "utf8");
  const m = text.match(/^SUPABASE_DB_URL=(.+)$/m);
  if (!m) {
    throw new Error("SUPABASE_DB_URL missing in .env.local");
  }
  return m[1];
}

export async function loadModuleLookups(client: Client) {
  const modules = await client.query<{ id: string; code: string }>(
    "select id, code from public.modules",
  );
  const departments = await client.query<{ id: string; code: string }>(
    "select id, code from public.departments",
  );
  const moduleByCode = new Map(modules.rows.map((m) => [m.code.toLowerCase(), m.id]));
  const departmentByCode = new Map(departments.rows.map((d) => [d.code.toLowerCase(), d.id]));
  return {
    moduleByCode,
    departmentByCode,
    moduleCodes: modules.rows.map((m) => m.code.toLowerCase()),
  };
}

export function loadAssignmentSample(relativePath: string): AssignmentImportFile {
  const jsonText = readFileSync(resolve(relativePath), "utf8");
  const fileParse = parseAssignmentImportJson(jsonText);
  if (!fileParse.ok) {
    throw new Error(fileParse.errors.join("\n"));
  }
  return fileParse.data;
}

export async function ensureRubric(client: Client, rubric: AssessmentImportRubric): Promise<string> {
  const existing = await client.query<{ id: string }>(
    "select id from public.rubrics where ref = $1 limit 1",
    [rubric.ref],
  );
  if (existing.rows[0]) {
    return existing.rows[0].id;
  }
  const inserted = await client.query<{ id: string }>(
    "insert into public.rubrics (ref, title) values ($1, $2) returning id",
    [rubric.ref, rubric.title],
  );
  const rubricId = inserted.rows[0].id;
  for (const [index, criterion] of rubric.criteria.entries()) {
    const crit = await client.query<{ id: string }>(
      `insert into public.rubric_criteria (rubric_id, name, max_score, sort_order)
       values ($1, $2, $3, $4) returning id`,
      [rubricId, criterion.name, criterion.max_score, index],
    );
    const criterionId = crit.rows[0].id;
    for (const level of criterion.levels) {
      await client.query(
        `insert into public.rubric_levels (criterion_id, score, descriptor) values ($1, $2, $3)`,
        [criterionId, level.score, level.descriptor],
      );
    }
  }
  return rubricId;
}

export async function publishAssignmentSample(
  client: Client,
  file: AssignmentImportFile,
  entryIndex: number,
): Promise<void> {
  const entry = file.assignments[entryIndex];
  const { moduleByCode, departmentByCode, moduleCodes } = await loadModuleLookups(client);
  const validation = validateAssignmentImport(file, { moduleCodes });
  if (!validation.ok) {
    throw new Error(validation.errors.join("\n"));
  }

  const rubricIds = new Map<string, string>();
  for (const rubric of file.rubrics) {
    rubricIds.set(rubric.ref, await ensureRubric(client, rubric));
  }

  const moduleId = moduleByCode.get(entry.module_code.toLowerCase()) ?? null;
  if (!moduleId) {
    throw new Error(`Module ${entry.module_code} not found`);
  }
  const departmentId = entry.department_code
    ? departmentByCode.get(entry.department_code.toLowerCase()) ?? null
    : null;
  const rubricId = rubricIds.get(entry.rubric_ref);
  if (!rubricId) {
    throw new Error(`Rubric ${entry.rubric_ref} not found`);
  }

  const versions = await client.query<{ version: number }>(
    "select version from public.assignments where code = $1 order by version desc limit 1",
    [entry.code],
  );
  const nextVersion = (versions.rows[0]?.version ?? 0) + 1;

  await client.query("begin");
  try {
    const row = await client.query<{ id: string }>(
      `insert into public.assignments (
         code, module_id, title, brief_md, rubric_id, submission_types, department_id,
         pass_mark_pct, is_test_out, version, status, is_sample
       ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'published',$11)
       returning id`,
      [
        entry.code,
        moduleId,
        entry.title,
        entry.brief_md,
        rubricId,
        entry.submission_types,
        departmentId,
        entry.pass_mark_pct,
        entry.is_test_out,
        nextVersion,
        entry.is_sample,
      ],
    );
    const assignmentId = row.rows[0].id;
    await client.query("update public.assignments set published_at = now() where id = $1", [
      assignmentId,
    ]);
    await client.query("commit");
    console.log(`Published ${entry.code} version ${nextVersion} id=${assignmentId}`);
  } catch (error) {
    await client.query("rollback");
    throw error;
  }
}
