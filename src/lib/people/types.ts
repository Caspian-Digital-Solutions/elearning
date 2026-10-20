import type { AppRole, ProgressScope, SpecialistPathway, Stream } from "@/lib/people/labels";

export type PersonRecord = {
  id: string;
  email: string;
  name: string;
  role: AppRole;
  scope: ProgressScope;
  departmentId: string | null;
  departmentName: string | null;
  stream: Stream | null;
  pathway: SpecialistPathway | null;
  cohortId: string | null;
  cohortName: string | null;
  isActive: boolean;
  /** The profile is created on the person's first Google sign-in. */
  firstSignInAt: string;
  lastSeenAt: string | null;
};

export type DepartmentOption = {
  id: string;
  name: string;
  parentId: string | null;
  isActive: boolean;
};

export type CohortRecord = {
  id: string;
  name: string;
  startDate: string | null;
  slot: string | null;
  notes: string | null;
  isArchived: boolean;
};

/** Set-up pending: an active learner with no department yet. */
export function isSetupPending(person: Pick<PersonRecord, "role" | "isActive" | "departmentId">): boolean {
  return person.role === "learner" && person.isActive && !person.departmentId;
}
