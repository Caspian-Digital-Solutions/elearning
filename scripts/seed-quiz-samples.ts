/**
 * Dev only: import and publish f1/f3 quiz samples from docs/content/samples/.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Client } from "pg";
import {
  parseAssessmentImportJson,
  validateAssessmentImport,
  type AssessmentImportFile,
} from "../src/lib/assessments/import";

const SAMPLE_FILES = [
  "docs/content/samples/f1_check_sample.json",
  "docs/content/samples/f3_safety_quiz_sample.json",
];

function loadDbUrl(): string {
  const text = readFileSync(resolve(".env.local"), "utf8");
  const m = text.match(/^SUPABASE_DB_URL=(.+)$/m);
  if (!m) {
    throw new Error("SUPABASE_DB_URL missing in .env.local");
  }
  return m[1];
}

async function loadLookups(client: Client) {
  const domains = await client.query<{ id: string; code: string }>(
    "select id, code from public.competency_domains",
  );
  const departments = await client.query<{ id: string; code: string }>(
    "select id, code from public.departments",
  );
  const modules = await client.query<{ id: string; code: string }>(
    "select id, code from public.modules",
  );
  const domainByCode = new Map(domains.rows.map((d) => [d.code.toUpperCase(), d.id]));
  const departmentByCode = new Map(departments.rows.map((d) => [d.code.toLowerCase(), d.id]));
  const moduleByCode = new Map(modules.rows.map((m) => [m.code.toLowerCase(), m.id]));
  return {
    domainByCode,
    departmentByCode,
    moduleCodes: modules.rows.map((m) => m.code.toLowerCase()),
    moduleByCode,
  };
}

function learnerOptions(item: AssessmentImportFile["items"][number]) {
  return (item.options ?? []).map((opt) => ({ id: opt.id, text: opt.text }));
}

function optionPoints(item: AssessmentImportFile["items"][number]): Record<string, number> {
  const points: Record<string, number> = {};
  for (const opt of item.options ?? []) {
    points[opt.id] = opt.points;
  }
  return points;
}

async function publishFile(client: Client, path: string) {
  const jsonText = readFileSync(resolve(path), "utf8");
  const fileParse = parseAssessmentImportJson(jsonText);
  if (!fileParse.ok) {
    throw new Error(fileParse.errors.join("\n"));
  }
  const settings = await client.query<{ value: unknown }>(
    "select value from public.app_settings where key = 'placement.week0_sections'",
  );
  const { domainByCode, departmentByCode, moduleCodes, moduleByCode } = await loadLookups(client);
  const validation = validateAssessmentImport(fileParse.data, {
    week0Sections: settings.rows[0]?.value,
    moduleCodes,
  });
  if (!validation.ok) {
    throw new Error(validation.errors.join("\n"));
  }
  const file = fileParse.data;
  const moduleCode = file.assessment.module_code?.toLowerCase() ?? "";
  const moduleId = moduleByCode.get(moduleCode) ?? null;

  const versions = await client.query<{ version: number }>(
    "select version from public.assessments where code = $1 order by version desc limit 1",
    [file.assessment.code],
  );
  const nextVersion = (versions.rows[0]?.version ?? 0) + 1;

  await client.query("begin");
  try {
    const asm = await client.query<{ id: string }>(
      `insert into public.assessments (
         code, title, type, instructions_md, time_guide_min, is_sample, version, status,
         module_id, pass_mark_pct, max_attempts, show_review_after_submit, items_per_attempt
       ) values ($1,$2,$3,$4,$5,$6,$7,'published',$8,$9,$10,$11,$12)
       returning id`,
      [
        file.assessment.code,
        file.assessment.title,
        file.assessment.type,
        file.assessment.instructions_md,
        file.assessment.time_guide_min,
        file.assessment.is_sample,
        nextVersion,
        moduleId,
        file.assessment.pass_mark_pct ?? 0,
        file.assessment.max_attempts ?? null,
        file.assessment.show_review_after_submit ?? true,
        file.assessment.items_per_attempt ?? null,
      ],
    );
    const assessmentId = asm.rows[0].id;
    await client.query("update public.assessments set published_at = now() where id = $1", [assessmentId]);

    const sectionIdByCode = new Map<string, string>();
    for (const [index, section] of file.sections.entries()) {
      const sec = await client.query<{ id: string }>(
        `insert into public.assessment_sections (
           assessment_id, code, title, max_score, counts_in_total, instructions_md, sort_order
         ) values ($1,$2,$3,$4,$5,$6,$7) returning id`,
        [
          assessmentId,
          section.code,
          section.title,
          section.max_score,
          section.counts_in_total,
          section.instructions_md ?? "",
          index,
        ],
      );
      sectionIdByCode.set(section.code, sec.rows[0].id);
    }

    for (const [index, item] of file.items.entries()) {
      const sectionId = sectionIdByCode.get(item.section);
      if (!sectionId) {
        continue;
      }
      const domainId = domainByCode.get(item.domain.toUpperCase()) ?? null;
      const departmentId = item.department
        ? departmentByCode.get(item.department.toLowerCase()) ?? null
        : null;
      const itemRow = await client.query<{ id: string }>(
        `insert into public.assessment_items (
           assessment_id, section_id, ref, type, sort_order, prompt_md, options,
           response_format, department_id, domain_id, difficulty, points, allow_multiple
         ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) returning id`,
        [
          assessmentId,
          sectionId,
          item.ref,
          item.type,
          item.sort_order ?? index,
          item.prompt_md,
          JSON.stringify(learnerOptions(item)),
          item.response_format ?? null,
          departmentId,
          domainId,
          item.difficulty ?? null,
          item.points,
          item.allow_multiple ?? false,
        ],
      );
      await client.query(
        `insert into public.assessment_item_keys (
           item_id, option_points, model_answer_md, explanation_md, marking_notes_md
         ) values ($1,$2,$3,$4,$5)`,
        [
          itemRow.rows[0].id,
          JSON.stringify(optionPoints(item)),
          item.model_answer_md ?? null,
          item.explanation_md ?? null,
          item.marking_notes_md ?? null,
        ],
      );
    }
    await client.query("commit");
    console.log(`Published ${file.assessment.code} version ${nextVersion}`);
  } catch (error) {
    await client.query("rollback");
    throw error;
  }
}

async function main() {
  const client = new Client({ connectionString: loadDbUrl(), ssl: { rejectUnauthorized: false } });
  await client.connect();
  for (const path of SAMPLE_FILES) {
    await publishFile(client, path);
  }
  await client.end();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
