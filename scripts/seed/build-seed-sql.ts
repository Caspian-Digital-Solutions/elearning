import { z } from "zod";

/**
 * Turns docs/seed/curriculum_v1_1.json into supabase/seed.sql.
 *
 * Reference data (departments, domains, stages, modules, links) is upserted
 * from the JSON every time: the JSON is the source of truth.
 * App settings and help pages are inserted only when missing, so a re-run
 * never overwrites an admin's edited setting or a trainer's written page.
 * Certification Skills and department boundaries stay in the JSON for Phase 2.
 */

const curriculumSchema = z.object({
  stages: z.array(
    z.object({
      code: z.string(),
      name: z.string(),
      week_start: z.number().int(),
      week_end: z.number().int(),
      hours_per_week: z.number().nullable(),
      sort_order: z.number().int(),
    }),
  ),
  competency_domains: z.array(z.object({ code: z.string(), name: z.string() })),
  departments: z.array(
    z.object({
      code: z.string(),
      name: z.string(),
      parent: z.string().nullable(),
      is_active: z.boolean(),
      note: z.string().optional(),
    }),
  ),
  department_domain_requirements: z.array(
    z.object({ department: z.string(), domain: z.string(), required: z.boolean() }),
  ),
  modules: z.array(
    z.object({
      code: z.string(),
      title: z.string(),
      stage: z.string(),
      week_start: z.number().int(),
      week_end: z.number().int(),
      live_hours: z.number(),
      async_hours: z.number(),
      domains: z.array(z.string()),
      assessed_by: z.string(),
      is_leadership: z.boolean(),
      sort_order: z.number().int(),
    }),
  ),
  app_settings: z.record(z.string(), z.record(z.string(), z.unknown())),
  help_pages: z.array(
    z.object({
      slug: z.string(),
      title: z.string(),
      status: z.literal("draft"),
      note: z.string().optional(),
    }),
  ),
});

export type Curriculum = z.infer<typeof curriculumSchema>;

export function parseCurriculum(raw: unknown): Curriculum {
  const curriculum = curriculumSchema.parse(raw);
  checkReferences(curriculum);
  return curriculum;
}

function checkReferences(curriculum: Curriculum) {
  const departments = new Set(curriculum.departments.map((d) => d.code));
  const domains = new Set(curriculum.competency_domains.map((d) => d.code));
  const stages = new Set(curriculum.stages.map((s) => s.code));
  const problems: string[] = [];

  for (const department of curriculum.departments) {
    if (department.parent !== null && !departments.has(department.parent)) {
      problems.push(`Department ${department.code} has unknown parent ${department.parent}.`);
    }
  }
  for (const mod of curriculum.modules) {
    if (!stages.has(mod.stage)) problems.push(`Module ${mod.code} has unknown stage ${mod.stage}.`);
    for (const domain of mod.domains) {
      if (!domains.has(domain)) problems.push(`Module ${mod.code} has unknown domain ${domain}.`);
    }
  }
  for (const requirement of curriculum.department_domain_requirements) {
    if (!departments.has(requirement.department)) {
      problems.push(`Requirement has unknown department ${requirement.department}.`);
    }
    if (!domains.has(requirement.domain)) {
      problems.push(`Requirement has unknown domain ${requirement.domain}.`);
    }
  }

  if (problems.length > 0) {
    throw new Error(`The curriculum file has broken references:\n- ${problems.join("\n- ")}`);
  }
}

/** SQL string literal with single quotes doubled. */
export function sqlText(value: string | null | undefined): string {
  if (value === null || value === undefined) return "null";
  return `'${value.replaceAll("'", "''")}'`;
}

function sqlNumber(value: number | null): string {
  if (value === null) return "null";
  if (!Number.isFinite(value)) throw new Error(`Not a finite number: ${value}`);
  return String(value);
}

function sqlBoolean(value: boolean): string {
  return value ? "true" : "false";
}

function sqlJson(value: unknown): string {
  return `${sqlText(JSON.stringify(value))}::jsonb`;
}

function valuesBlock(rows: string[][]): string {
  return rows.map((row) => `  (${row.join(", ")})`).join(",\n");
}

export const helpPagePlaceholder = "Placeholder. A trainer writes this page before launch.";

export function buildSeedSql(curriculum: Curriculum, sourceFile: string): string {
  const parts: string[] = [];

  parts.push(
    [
      "-- GENERATED FILE. Do not edit by hand.",
      `-- Source: ${sourceFile}`,
      "-- Regenerate with: npm run db:seed:generate",
      "-- Safe to run more than once. Reference data is upserted from the JSON;",
      "-- app settings and help pages are inserted only when missing.",
      "",
      "begin;",
    ].join("\n"),
  );

  parts.push(
    [
      "-- Departments",
      "insert into public.departments (code, name, is_active, note) values",
      valuesBlock(
        curriculum.departments.map((d) => [
          sqlText(d.code),
          sqlText(d.name),
          sqlBoolean(d.is_active),
          sqlText(d.note ?? null),
        ]),
      ),
      "on conflict (code) do update set",
      "  name = excluded.name,",
      "  is_active = excluded.is_active,",
      "  note = excluded.note;",
      "",
      "update public.departments child",
      "set parent_id = parent.id",
      "from (values",
      valuesBlock(
        curriculum.departments.map((d) => [sqlText(d.code), sqlText(d.parent)]),
      ),
      ") as links (code, parent_code)",
      "left join public.departments parent on parent.code = links.parent_code",
      "where child.code = links.code",
      "  and child.parent_id is distinct from parent.id;",
    ].join("\n"),
  );

  parts.push(
    [
      "-- Competency domains",
      "insert into public.competency_domains (code, name) values",
      valuesBlock(curriculum.competency_domains.map((d) => [sqlText(d.code), sqlText(d.name)])),
      "on conflict (code) do update set",
      "  name = excluded.name;",
    ].join("\n"),
  );

  parts.push(
    [
      "-- Stages",
      "insert into public.stages (code, name, week_start, week_end, hours_per_week, sort_order) values",
      valuesBlock(
        curriculum.stages.map((s) => [
          sqlText(s.code),
          sqlText(s.name),
          sqlNumber(s.week_start),
          sqlNumber(s.week_end),
          sqlNumber(s.hours_per_week),
          sqlNumber(s.sort_order),
        ]),
      ),
      "on conflict (code) do update set",
      "  name = excluded.name,",
      "  week_start = excluded.week_start,",
      "  week_end = excluded.week_end,",
      "  hours_per_week = excluded.hours_per_week,",
      "  sort_order = excluded.sort_order;",
    ].join("\n"),
  );

  parts.push(
    [
      "-- Modules",
      "insert into public.modules",
      "  (code, title, stage_id, week_start, week_end, live_hours, async_hours, assessed_by, is_leadership, sort_order)",
      "select v.code, v.title, s.id, v.week_start, v.week_end, v.live_hours, v.async_hours, v.assessed_by, v.is_leadership, v.sort_order",
      "from (values",
      valuesBlock(
        curriculum.modules.map((m) => [
          sqlText(m.code),
          sqlText(m.title),
          sqlText(m.stage),
          sqlNumber(m.week_start),
          sqlNumber(m.week_end),
          `${sqlNumber(m.live_hours)}::numeric`,
          `${sqlNumber(m.async_hours)}::numeric`,
          sqlText(m.assessed_by),
          sqlBoolean(m.is_leadership),
          sqlNumber(m.sort_order),
        ]),
      ),
      ") as v (code, title, stage_code, week_start, week_end, live_hours, async_hours, assessed_by, is_leadership, sort_order)",
      "join public.stages s on s.code = v.stage_code",
      "on conflict (code) do update set",
      "  title = excluded.title,",
      "  stage_id = excluded.stage_id,",
      "  week_start = excluded.week_start,",
      "  week_end = excluded.week_end,",
      "  live_hours = excluded.live_hours,",
      "  async_hours = excluded.async_hours,",
      "  assessed_by = excluded.assessed_by,",
      "  is_leadership = excluded.is_leadership,",
      "  sort_order = excluded.sort_order;",
    ].join("\n"),
  );

  parts.push(
    [
      "-- Module domains",
      "insert into public.module_domains (module_id, domain_id)",
      "select m.id, d.id",
      "from (values",
      valuesBlock(
        curriculum.modules.flatMap((m) => m.domains.map((domain) => [sqlText(m.code), sqlText(domain)])),
      ),
      ") as v (module_code, domain_code)",
      "join public.modules m on m.code = v.module_code",
      "join public.competency_domains d on d.code = v.domain_code",
      "on conflict (module_id, domain_id) do nothing;",
    ].join("\n"),
  );

  parts.push(
    [
      "-- Department domain requirements",
      "insert into public.department_domain_requirements (department_id, domain_id, required)",
      "select dep.id, dom.id, v.required",
      "from (values",
      valuesBlock(
        curriculum.department_domain_requirements.map((r) => [
          sqlText(r.department),
          sqlText(r.domain),
          sqlBoolean(r.required),
        ]),
      ),
      ") as v (department_code, domain_code, required)",
      "join public.departments dep on dep.code = v.department_code",
      "join public.competency_domains dom on dom.code = v.domain_code",
      "on conflict (department_id, domain_id) do update set",
      "  required = excluded.required;",
    ].join("\n"),
  );

  parts.push(
    [
      "-- App settings (PROPOSED values; inserted only when the key is missing)",
      "insert into public.app_settings (key, value, note) values",
      valuesBlock(
        Object.entries(curriculum.app_settings).map(([key, value]) => [
          sqlText(key),
          sqlJson(value),
          sqlText(typeof value.note === "string" ? value.note : null),
        ]),
      ),
      "on conflict (key) do nothing;",
    ].join("\n"),
  );

  parts.push(
    [
      "-- Help pages (drafts with a placeholder; inserted only when the slug is missing)",
      "insert into public.pages (slug, title, body_md, status) values",
      valuesBlock(
        curriculum.help_pages.map((p) => [
          sqlText(p.slug),
          sqlText(p.title),
          sqlText(p.note ? `${helpPagePlaceholder} ${p.note}.` : helpPagePlaceholder),
          sqlText(p.status),
        ]),
      ),
      "on conflict (slug) do nothing;",
    ].join("\n"),
  );

  parts.push("commit;");

  return `${parts.join("\n\n")}\n`;
}

/** Row counts the seed must produce. db:check compares the database with these. */
export function expectedCounts(curriculum: Curriculum) {
  return {
    departments: curriculum.departments.length,
    competency_domains: curriculum.competency_domains.length,
    stages: curriculum.stages.length,
    modules: curriculum.modules.length,
    module_domains: curriculum.modules.reduce((total, m) => total + new Set(m.domains).size, 0),
    department_domain_requirements: curriculum.department_domain_requirements.length,
    app_settings: Object.keys(curriculum.app_settings).length,
    pages: curriculum.help_pages.length,
  };
}
