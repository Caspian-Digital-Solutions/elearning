import { Constants, type Database } from "@/lib/types/database";

type Enums = Database["public"]["Enums"];

export type AppRole = Enums["app_role"];
export type ProgressScope = Enums["progress_scope_type"];
export type Stream = Enums["stream_type"];
export type SpecialistPathway = Enums["specialist_pathway_type"];

export const appRoleValues = Constants.public.Enums.app_role;
export const progressScopeValues = Constants.public.Enums.progress_scope_type;
export const streamValues = Constants.public.Enums.stream_type;
export const specialistPathwayValues = Constants.public.Enums.specialist_pathway_type;

export { roleLabels as roleNames } from "@/config/navigation";

export const scopeNames: Record<ProgressScope, string> = {
  self: "Self",
  department: "Department",
  all: "All",
};

export const streamNames: Record<Stream, string> = {
  foundation: "Foundation",
  practitioner: "Practitioner",
  practitioner_fast_track: "Practitioner fast track",
  champion: "Champion",
};

export const pathwayNames: Record<SpecialistPathway, string> = {
  business: "Business",
  builder: "Builder",
  technical: "Technical",
};

/** The usual progress scope for each role. The admin may still choose another. */
export const suggestedScope: Record<AppRole, ProgressScope> = {
  learner: "self",
  champion: "self",
  manager: "department",
  trainer: "all",
  admin: "all",
};

export function isOneOf<T extends string>(values: readonly T[], value: unknown): value is T {
  return typeof value === "string" && (values as readonly string[]).includes(value);
}
