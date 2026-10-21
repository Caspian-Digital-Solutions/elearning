import { describe, expect, it } from "vitest";
import {
  applyStreamRulesForModule,
  defaultPlanStreamRules,
  streamRulesForbidF3TestOut,
  testOutRuleForModule,
} from "@/lib/plan/stream-rules";

const base = {
  departmentCode: "ENG",
  role: "learner",
  rules: defaultPlanStreamRules,
  moduleWeekEnd: 8,
  isLeadership: false,
  isSpecialist: false,
};

describe("applyStreamRulesForModule (DL-027)", () => {
  it("foundation requires F3 with no test-out gate", () => {
    const decision = applyStreamRulesForModule({
      ...base,
      stream: "foundation",
      bridges: [],
      moduleCode: "F3",
    });
    expect(decision.status).toBe("required");
  });

  it("practitioner puts F1–F6 in test_out_pending and keeps F7 required", () => {
    expect(
      applyStreamRulesForModule({ ...base, stream: "practitioner", bridges: [], moduleCode: "F1" }).status,
    ).toBe("test_out_pending");
    expect(
      applyStreamRulesForModule({ ...base, stream: "practitioner", bridges: [], moduleCode: "F3" }).status,
    ).toBe("test_out_pending");
    expect(
      applyStreamRulesForModule({ ...base, stream: "practitioner", bridges: [], moduleCode: "F7" }).status,
    ).toBe("required");
  });

  it("fast track adds week 5 test-out pending on P1 and P2", () => {
    expect(
      applyStreamRulesForModule({
        ...base,
        stream: "practitioner_fast_track",
        bridges: [],
        moduleCode: "P1",
      }).status,
    ).toBe("test_out_pending");
    expect(
      applyStreamRulesForModule({
        ...base,
        stream: "practitioner_fast_track",
        bridges: [],
        moduleCode: "P3",
      }).status,
    ).toBe("required");
  });

  it("champion matches fast track test-outs", () => {
    expect(
      applyStreamRulesForModule({ ...base, stream: "champion", bridges: [], moduleCode: "P2" }).status,
    ).toBe("test_out_pending");
  });

  it("bridge wins over test_out_pending on the same module", () => {
    const decision = applyStreamRulesForModule({
      ...base,
      stream: "practitioner",
      bridges: ["F4"],
      moduleCode: "F4",
    });
    expect(decision.status).toBe("bridge");
    expect(decision.dueWeek).toBe(4);
  });

  it("uses test-out week as due week for pending modules", () => {
    const decision = applyStreamRulesForModule({
      ...base,
      stream: "practitioner",
      bridges: [],
      moduleCode: "F2",
    });
    expect(decision.dueWeek).toBe(1);
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

describe("testOutRuleForModule", () => {
  it("finds week1 test-out for F3 on practitioner stream", () => {
    const rule = testOutRuleForModule(defaultPlanStreamRules.practitioner, "F3");
    expect(rule?.code).toBe("week1");
    expect(rule?.source_code).toBe("week1-testout");
  });
});

describe("streamRulesForbidF3TestOut", () => {
  it("flags when F3 appears in tested_out or optional", () => {
    expect(streamRulesForbidF3TestOut(defaultPlanStreamRules)).toBe(false);
    const badTested = {
      ...defaultPlanStreamRules,
      practitioner: {
        ...defaultPlanStreamRules.practitioner,
        tested_out: ["F3"],
      },
    };
    expect(streamRulesForbidF3TestOut(badTested)).toBe(true);
    const badOptional = {
      ...defaultPlanStreamRules,
      practitioner: {
        ...defaultPlanStreamRules.practitioner,
        optional: ["F3"],
      },
    };
    expect(streamRulesForbidF3TestOut(badOptional)).toBe(true);
  });
});
