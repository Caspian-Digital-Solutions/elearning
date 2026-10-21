import { describe, expect, it } from "vitest";
import {
  applyStreamRulesForModule,
  defaultPlanStreamRules,
  streamRulesForbidF3TestOut,
} from "@/lib/plan/stream-rules";

const base = {
  departmentCode: "ENG",
  role: "learner",
  rules: defaultPlanStreamRules,
  moduleWeekEnd: 8,
  isLeadership: false,
  isSpecialist: false,
};

describe("applyStreamRulesForModule", () => {
  it("foundation requires F3", () => {
    const decision = applyStreamRulesForModule({
      ...base,
      stream: "foundation",
      bridges: [],
      moduleCode: "F3",
    });
    expect(decision.status).toBe("required");
  });

  it("practitioner tests out F1 but not F3", () => {
    expect(
      applyStreamRulesForModule({ ...base, stream: "practitioner", bridges: [], moduleCode: "F1" }).status,
    ).toBe("tested_out");
    expect(
      applyStreamRulesForModule({ ...base, stream: "practitioner", bridges: [], moduleCode: "F3" }).status,
    ).toBe("required");
  });

  it("practitioner fast track makes P1 optional", () => {
    expect(
      applyStreamRulesForModule({
        ...base,
        stream: "practitioner_fast_track",
        bridges: [],
        moduleCode: "P1",
      }).status,
    ).toBe("optional");
  });

  it("champion matches fast track optional P2", () => {
    expect(
      applyStreamRulesForModule({ ...base, stream: "champion", bridges: [], moduleCode: "P2" }).status,
    ).toBe("optional");
  });

  it("bridge wins over tested_out", () => {
    const decision = applyStreamRulesForModule({
      ...base,
      stream: "practitioner",
      bridges: ["F4"],
      moduleCode: "F4",
    });
    expect(decision.status).toBe("bridge");
    expect(decision.dueWeek).toBe(4);
  });

  it("leadership required for senior management department", () => {
    const decision = applyStreamRulesForModule({
      ...base,
      stream: "practitioner",
      bridges: [],
      moduleCode: "L2",
      isLeadership: true,
      departmentCode: "SENIOR_MGMT",
    });
    expect(decision.status).toBe("required");
  });

  it("specialist modules are not applicable", () => {
    const decision = applyStreamRulesForModule({
      ...base,
      stream: "champion",
      bridges: [],
      moduleCode: "S1",
      isSpecialist: true,
    });
    expect(decision.status).toBe("not_applicable");
  });
});

describe("streamRulesForbidF3TestOut", () => {
  it("flags when F3 appears in a tested_out list", () => {
    expect(streamRulesForbidF3TestOut(defaultPlanStreamRules)).toBe(false);
    const bad = {
      ...defaultPlanStreamRules,
      practitioner: {
        ...defaultPlanStreamRules.practitioner,
        tested_out: [...defaultPlanStreamRules.practitioner.tested_out, "F3"],
      },
    };
    expect(streamRulesForbidF3TestOut(bad)).toBe(true);
  });
});
