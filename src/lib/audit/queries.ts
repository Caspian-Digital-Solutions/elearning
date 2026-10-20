import "server-only";

import { z } from "zod";
import { changedFields, type FieldChange } from "@/lib/audit/diff";
import { startOfMalaysiaDay } from "@/lib/format";
import { settingName } from "@/lib/settings/describe";
import { createClient } from "@/lib/supabase/server";

export const auditPageSize = 50;
export const auditExportLimit = 5000;

export const auditTableNames: Record<string, string> = {
  profiles: "People",
  cohorts: "Cohorts",
  app_settings: "Settings",
};

export const auditActionNames: Record<string, string> = {
  insert: "Created",
  update: "Changed",
  delete: "Deleted",
};

const date = z.iso.date().optional().catch(undefined);
const id = z.uuid().optional().catch(undefined);

const filterSchema = z.object({
  from: date,
  to: date,
  who: id,
  table: z
    .string()
    .regex(/^[a-z_]{1,63}$/)
    .optional()
    .catch(undefined),
  person: id,
  page: z.coerce.number().int().min(1).max(10_000).optional().catch(undefined),
});

export type AuditFilters = z.infer<typeof filterSchema>;

type SearchParams = Record<string, string | string[] | undefined>;

/** Reads the filters from the address bar. Anything malformed is ignored, not trusted. */
export function parseAuditFilters(params: SearchParams | URLSearchParams): AuditFilters {
  const read = (key: string) => {
    const value = params instanceof URLSearchParams ? params.get(key) : params[key];
    const single = Array.isArray(value) ? value[0] : value;
    return single === "" || single === null ? undefined : single;
  };
  return filterSchema.parse({
    from: read("from"),
    to: read("to"),
    who: read("who"),
    table: read("table"),
    person: read("person"),
    page: read("page"),
  });
}

export type AuditEntry = {
  id: string;
  at: string;
  who: string;
  action: string;
  table: string;
  affected: string;
  changes: FieldChange[];
  reason: string;
};

type AuditRow = {
  id: string;
  at: string;
  actor_id: string | null;
  action: string;
  table_name: string;
  row_id: string | null;
  before: unknown;
  after: unknown;
  reason: string | null;
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function nextDay(day: string): string | null {
  const start = startOfMalaysiaDay(day);
  return start ? new Date(Date.parse(start) + 24 * 60 * 60 * 1000).toISOString() : null;
}

async function queryAudit(filters: AuditFilters, offset: number, limit: number) {
  const supabase = await createClient();
  let query = supabase
    .from("audit_log")
    .select("id, at, actor_id, action, table_name, row_id, before, after, reason", { count: "exact" })
    .order("at", { ascending: false })
    .order("id", { ascending: false })
    .range(offset, offset + limit - 1);

  const from = filters.from ? startOfMalaysiaDay(filters.from) : null;
  const to = filters.to ? nextDay(filters.to) : null;
  if (from) query = query.gte("at", from);
  if (to) query = query.lt("at", to);
  if (filters.who) query = query.eq("actor_id", filters.who);
  if (filters.table) query = query.eq("table_name", filters.table);
  if (filters.person) {
    // The person may be the changed row itself, or named in it (for example a mark's user_id).
    query = query.or(
      `row_id.eq.${filters.person},after->>user_id.eq.${filters.person},before->>user_id.eq.${filters.person}`,
    );
  }

  const { data, error, count } = await query;
  if (error) {
    throw new Error("Could not load the audit log.");
  }
  return { rows: data as AuditRow[], total: count ?? 0, supabase };
}

function recordOf(row: AuditRow): Record<string, unknown> {
  const record = row.after ?? row.before;
  return typeof record === "object" && record !== null ? (record as Record<string, unknown>) : {};
}

async function describe(rows: AuditRow[], supabase: Awaited<ReturnType<typeof createClient>>): Promise<AuditEntry[]> {
  const ids = new Set<string>();
  const changesById = new Map<string, FieldChange[]>();
  for (const row of rows) {
    if (row.actor_id) ids.add(row.actor_id);
    if (row.row_id) ids.add(row.row_id);
    const changes = changedFields(row.before, row.after).filter(
      (change) => !(change.before === "empty" && change.after === "empty"),
    );
    changesById.set(row.id, changes);
    for (const change of changes) {
      for (const value of [change.before, change.after]) {
        if (uuidPattern.test(value)) ids.add(value);
      }
    }
  }

  const names = new Map<string, string>();
  if (ids.size > 0) {
    const list = [...ids];
    const [people, departments, cohorts] = await Promise.all([
      supabase.from("profiles").select("id, full_name, email").in("id", list),
      supabase.from("departments").select("id, name").in("id", list),
      supabase.from("cohorts").select("id, name").in("id", list),
    ]);
    for (const person of people.data ?? []) names.set(person.id, person.full_name?.trim() || person.email);
    for (const department of departments.data ?? []) names.set(department.id, department.name);
    for (const cohort of cohorts.data ?? []) names.set(cohort.id, cohort.name);
  }

  const nameOf = (value: string) => names.get(value) ?? value;

  return rows.map((row) => {
    const record = recordOf(row);
    let affected: string;
    if (row.table_name === "app_settings" && typeof record.key === "string") {
      affected = settingName(record.key);
    } else if (row.table_name === "profiles") {
      const fallback = typeof record.full_name === "string" && record.full_name.trim() ? record.full_name : record.email;
      affected = (row.row_id && names.get(row.row_id)) || String(fallback ?? "Unknown person");
    } else if (typeof record.name === "string") {
      affected = record.name;
    } else {
      affected = (row.row_id && names.get(row.row_id)) || "Record no longer exists";
    }

    return {
      id: row.id,
      at: row.at,
      who: row.actor_id ? (names.get(row.actor_id) ?? "Removed person") : "System",
      action: auditActionNames[row.action] ?? row.action,
      table: auditTableNames[row.table_name] ?? row.table_name,
      affected,
      changes: (changesById.get(row.id) ?? []).map((change) => ({
        field: change.field,
        before: nameOf(change.before),
        after: nameOf(change.after),
      })),
      reason: row.reason ?? "",
    };
  });
}

/** One page of the audit log, newest first, with names in place of ids. */
export async function loadAuditPage(filters: AuditFilters) {
  const page = filters.page ?? 1;
  const { rows, total, supabase } = await queryAudit(filters, (page - 1) * auditPageSize, auditPageSize);
  return { entries: await describe(rows, supabase), total, page, pageCount: Math.max(1, Math.ceil(total / auditPageSize)) };
}

/** Every matching entry for the CSV export, up to auditExportLimit. */
export async function loadAuditExport(filters: AuditFilters) {
  // The API returns at most 1,000 rows per request, so read in batches.
  const batch = 1000;
  const first = await queryAudit(filters, 0, batch);
  const rows = [...first.rows];
  while (rows.length < Math.min(first.total, auditExportLimit)) {
    const next = await queryAudit(filters, rows.length, batch);
    if (next.rows.length === 0) break;
    rows.push(...next.rows);
  }
  return { entries: await describe(rows.slice(0, auditExportLimit), first.supabase), total: first.total };
}

export function formatChanges(changes: FieldChange[]): string {
  return changes.map((change) => `${change.field}: ${change.before} → ${change.after}`).join("; ");
}
