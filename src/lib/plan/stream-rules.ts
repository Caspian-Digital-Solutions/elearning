import type { Stream } from "@/lib/people/labels";
import {
  type ApplyStreamRulesInput,
  type PlanModuleDecision,
  type PlanStreamRules,
  type PlanStatus,
  type StreamRuleBlock,
  type TestOutRule,
} from "@/lib/plan/types";

const leadershipCodes = ["L1", "L2", "L3"] as const;
const specialistPrefix = "S";

const week1TestOut: TestOutRule = {
  code: "week1",
  modules: ["F1", "F2", "F3", "F4", "F5", "F6"],
  via: "assessment",
  source_code: "week1-testout",
  week: 1,
};

const week5TestOut: TestOutRule = {
  code: "week5",
  modules: ["P1", "P2"],
  via: "assignment",
  source_code: "week5-testout",
  week: 5,
};

const foundationRequired = [
  "F1",
  "F2",
  "F3",
  "F4",
  "F5",
  "F6",
  "F7",
  "F8",
  "F9",
  "P1",
  "P2",
  "P3",
  "P4",
  "P5",
  "P6",
  "P7",
  "P8",
  "P9",
  "P10",
];

const practitionerRequired = ["F7", "F8", "F9", "P1", "P2", "P3", "P4", "P5", "P6", "P7", "P8", "P9", "P10"];

const fastTrackRequired = ["F7", "F8", "F9", "P3", "P4", "P5", "P6", "P7", "P8", "P9", "P10"];

export const defaultPlanStreamRules: PlanStreamRules = {
  foundation: {
    required: foundationRequired,
    tested_out: [],
    optional: [],
    test_outs: [],
  },
  practitioner: {
    required: practitionerRequired,
    tested_out: [],
    optional: [],
    test_outs: [week1TestOut],
  },
  practitioner_fast_track: {
    required: fastTrackRequired,
    tested_out: [],
    optional: [],
    test_outs: [week1TestOut, week5TestOut],
  },
  champion: {
    required: fastTrackRequired,
    tested_out: [],
    optional: [],
    test_outs: [week1TestOut, week5TestOut],
    specialist_eligible: true,
  },
  bridge_due_week: 4,
  leadership_required_department_codes: ["SENIOR_MGMT"],
};

export function blockForStream(stream: Stream, rules: PlanStreamRules): StreamRuleBlock {
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

/** Test-out gate that covers this module, if any (first match by week). */
export function testOutRuleForModule(block: StreamRuleBlock, moduleCode: string): TestOutRule | null {
  const upper = moduleCode.toUpperCase();
  let match: TestOutRule | null = null;
  for (const rule of block.test_outs) {
    if (rule.modules.some((code) => code.toUpperCase() === upper)) {
      if (!match || rule.week < match.week) {
        match = rule;
      }
    }
  }
  return match;
}

function statusFromLists(moduleCode: string, block: StreamRuleBlock): PlanStatus | null {
  const upper = moduleCode.toUpperCase();
  if (block.required.some((code) => code.toUpperCase() === upper)) {
    return "required";
  }
  if (block.optional.some((code) => code.toUpperCase() === upper)) {
    return "optional";
  }
  if (block.tested_out.some((code) => code.toUpperCase() === upper)) {
    return "tested_out";
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
  const streamLabel = input.stream.replace(/_/g, " ");

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
  const pendingTestOut = testOutRuleForModule(block, moduleCode);
  if (pendingTestOut) {
    return {
      moduleCode,
      status: "test_out_pending",
      dueWeek: pendingTestOut.week,
      reason: `${streamLabel} stream: pass test-out to skip`,
    };
  }

  const fromLists = statusFromLists(moduleCode, block);
  const status: PlanStatus = fromLists ?? "not_applicable";
  const reason =
    status === "tested_out"
      ? `${streamLabel} stream: tested out`
      : status === "optional"
        ? `${streamLabel} stream: optional`
        : status === "required"
          ? `${streamLabel} stream: required`
          : "Not in plan for this stream";

  return {
    moduleCode,
    status,
    dueWeek: status === "not_applicable" || status === "tested_out" ? null : moduleWeekEnd,
    reason,
  };
}

/** F3 must never be listed as tested out or optional in settings (validator helper for Admin JSON). */
export function streamRulesForbidF3TestOut(rules: PlanStreamRules): boolean {
  const blocks = [rules.foundation, rules.practitioner, rules.practitioner_fast_track, rules.champion];
  return blocks.some(
    (block) =>
      block.tested_out.includes("F3") ||
      block.optional.some((code) => code.toUpperCase() === "F3"),
  );
}
