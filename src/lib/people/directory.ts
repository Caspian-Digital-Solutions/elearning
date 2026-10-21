import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { CohortRecord, DepartmentOption, PersonRecord } from "@/lib/people/types";

/** Everyone the caller may see (row-level security decides), sorted by name. */
export async function loadPeople(): Promise<PersonRecord[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, email, full_name, role, progress_scope, department_id, stream, specialist_pathway, cohort_id, is_active, is_test_account, created_at, last_seen_at, departments ( name ), cohorts ( name )",
    )
    .eq("is_test_account", false)
    .order("full_name", { ascending: true, nullsFirst: false })
    .order("email");
  if (error) {
    throw new Error("Could not load people.");
  }
  return data.map((row) => ({
    id: row.id,
    email: row.email,
    name: row.full_name?.trim() || row.email,
    role: row.role,
    scope: row.progress_scope,
    departmentId: row.department_id,
    departmentName: row.departments?.name ?? null,
    stream: row.stream,
    pathway: row.specialist_pathway,
    cohortId: row.cohort_id,
    cohortName: row.cohorts?.name ?? null,
    isActive: row.is_active,
    firstSignInAt: row.created_at,
    lastSeenAt: row.last_seen_at,
  }));
}

export async function loadDepartments(): Promise<DepartmentOption[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("departments")
    .select("id, name, parent_id, is_active")
    .order("name");
  if (error) {
    throw new Error("Could not load departments.");
  }
  return data.map((row) => ({ id: row.id, name: row.name, parentId: row.parent_id, isActive: row.is_active }));
}

export async function loadCohorts(): Promise<CohortRecord[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cohorts")
    .select("id, name, start_date, slot, notes, is_archived")
    .order("is_archived")
    .order("start_date", { ascending: true, nullsFirst: false })
    .order("name");
  if (error) {
    throw new Error("Could not load cohorts.");
  }
  return data.map((row) => ({
    id: row.id,
    name: row.name,
    startDate: row.start_date,
    slot: row.slot,
    notes: row.notes,
    isArchived: row.is_archived,
  }));
}
