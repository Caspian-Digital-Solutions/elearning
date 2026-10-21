import type { Stream } from "@/lib/people/labels";

export type PlanStatus =
  | "required"
  | "optional"
  | "tested_out"
  | "test_out_pending"
  | "bridge"
  | "not_applicable";

export type TestOutVia = "assessment" | "assignment";

export type TestOutRule = {
  code: string;
  modules: string[];
  via: TestOutVia;
  source_code: string;
  week: number;
};

export type StreamRuleBlock = {
  required: string[];
  tested_out: string[];
  optional: string[];
  test_outs: TestOutRule[];
  /** Champion stream only — metadata for Specialist track (Phase 3). */
  specialist_eligible?: boolean;
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
