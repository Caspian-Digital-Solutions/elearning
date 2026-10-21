import type { Stream } from "@/lib/people/labels";

export type PlanStatus = "required" | "optional" | "tested_out" | "bridge" | "not_applicable";

export type StreamRuleBlock = {
  required: string[];
  tested_out: string[];
  optional: string[];
};

export type PlanStreamRules = {
  foundation: StreamRuleBlock;
  practitioner: StreamRuleBlock;
  practitioner_fast_track: StreamRuleBlock;
  champion: StreamRuleBlock;
  bridge_due_week: number;
  /** Department codes where leadership modules L1–L3 are required. */
  leadership_required_department_codes: string[];
};

export type PlanModuleDecision = {
  moduleCode: string;
  status: PlanStatus;
  dueWeek: number | null;
  reason: string;
};

export type ApplyStreamRulesInput = {
  stream: Stream;
  bridges: string[];
  departmentCode: string | null;
  role: string;
  rules: PlanStreamRules;
  moduleCode: string;
  moduleWeekEnd: number | null;
  isLeadership: boolean;
  isSpecialist: boolean;
};
