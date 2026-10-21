import type { Stream } from "@/lib/people/labels";
import {
  type ApplyStreamRulesInput,
  type PlanModuleDecision,
  type PlanStreamRules,
  type PlanStatus,
  type StreamRuleBlock,
} from "@/lib/plan/types";

const leadershipCodes = ["L1", "L2", "L3"] as const;
const specialistPrefix = "S";

export const defaultPlanStreamRules: PlanStreamRules = {
  foundation: {
    required: ["F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8", "F9", "P1", "P2", "P3", "P4", "P5", "P6", "P7", "P8", "P9", "P10"],
    tested_out: [],
    optional: [],
  },
  practitioner: {
    required: ["F3", "F7", "F8", "F9", "P1", "P2", "P3", "P4", "P5", "P6", "P7", "P8", "P9", "P10"],
    tested_out: ["F1", "F2", "F4", "F5", "F6"],
    optional: [],
  },
  practitioner_fast_track: {
    required: ["F3", "F7", "F8", "F9", "P3", "P4", "P5", "P6", "P7", "P8", "P9", "P10"],
    tested_out: ["F1", "F2", "F4", "F5", "F6"],
    optional: ["P1", "P2"],
  },
  champion: {
    required: ["F3", "F7", "F8", "F9", "P3", "P4", "P5", "P6", "P7", "P8", "P9", "P10"],
    tested_out: ["F1", "F2", "F4", "F5", "F6"],
    optional: ["P1", "P2"],
  },
  bridge_due_week: 4,
  leadership_required_department_codes: ["SENIOR_MGMT"],
};

function blockForStream(stream: Stream, rules: PlanStreamRules): StreamRuleBlock {
  switch (stream) {
    case "foundation":
      return rules.foundation;
    case "practitioner":
      return rules.practitioner;
    case "practitioner_fast_track":
      return rules.practitioner_fast_track;
    case "champion":
      return rules.champion;
    default:
      return rules.foundation;
  }
}

function statusFromBlock(moduleCode: string, block: StreamRuleBlock): PlanStatus | null {
  if (block.tested_out.includes(moduleCode)) {
    return "tested_out";
  }
  if (block.optional.includes(moduleCode)) {
    return "optional";
  }
  if (block.required.includes(moduleCode)) {
    return "required";
  }
  return null;
}

function leadershipStatus(input: ApplyStreamRulesInput): PlanStatus {
  const dept = input.departmentCode?.toUpperCase() ?? "";
  const requiredDepts = input.rules.leadership_required_department_codes.map((code) => code.toUpperCase());
  if (requiredDepts.includes(dept)) {
    return "required";
  }
  if (input.role === "manager") {
    return "optional";
  }
  return "not_applicable";
}

/** Single module decision from stream rules, bridges, and leadership/specialist handling. */
export function applyStreamRulesForModule(input: ApplyStreamRulesInput): PlanModuleDecision {
  const { moduleCode, rules, bridges, moduleWeekEnd, isLeadership, isSpecialist } = input;

  if (isSpecialist || moduleCode.startsWith(specialistPrefix)) {
    return {
      moduleCode,
      status: "not_applicable",
      dueWeek: null,
      reason: "Specialist track (Phase 3 nomination not implemented)",
    };
  }

  if (isLeadership || leadershipCodes.includes(moduleCode as (typeof leadershipCodes)[number])) {
    const status = leadershipStatus(input);
    return {
      moduleCode,
      status,
      dueWeek: status === "not_applicable" ? null : moduleWeekEnd,
      reason:
        status === "required"
          ? "Leadership briefing required for Senior Management"
          : status === "optional"
            ? "Leadership briefing optional for managers"
            : "Leadership briefing not applicable",
    };
  }

  if (bridges.includes(moduleCode)) {
    return {
      moduleCode,
      status: "bridge",
      dueWeek: rules.bridge_due_week,
      reason: "Bridge module from Week 0 placement",
    };
  }

  const block = blockForStream(input.stream, rules);
  const fromBlock = statusFromBlock(moduleCode, block);
  const status: PlanStatus = fromBlock ?? "not_applicable";
  const reason =
    status === "tested_out"
      ? `${input.stream} stream: tested out`
      : status === "optional"
        ? `${input.stream} stream: optional`
        : status === "required"
          ? `${input.stream} stream: required`
          : "Not in plan for this stream";

  return {
    moduleCode,
    status,
    dueWeek: status === "not_applicable" || status === "tested_out" ? null : moduleWeekEnd,
    reason,
  };
}

/** F3 must never be tested out in settings (validator helper for Admin JSON). */
export function streamRulesForbidF3TestOut(rules: PlanStreamRules): boolean {
  const blocks = [rules.foundation, rules.practitioner, rules.practitioner_fast_track, rules.champion];
  return blocks.some((block) => block.tested_out.includes("F3"));
}
