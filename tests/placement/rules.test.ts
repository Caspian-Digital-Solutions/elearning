import { describe, expect, it } from "vitest";
import {
  computePlacement,
  computeRequiredDomainFlags,
  departmentSubmitBlockMessage,
  foundationModuleOrder,
  itemAppliesToLearner,
  loadDefaultPlacementSettings,
  resolveDepartmentItemDepartmentId,
  type PlacementScoredItem,
} from "@/lib/placement";

const settings = loadDefaultPlacementSettings();

const DEPT_CONTENT = "dept-content";
const DEPT_PERFORMANCE = "dept-performance";
const DEPT_SEO = "dept-seo";

const baseInput = {
  settings,
  userDepartmentId: DEPT_CONTENT,
  parentDepartmentId: null as string | null,
  departmentIdsWithDepartmentItems: [DEPT_CONTENT],
  moduleOrder: [...foundationModuleOrder],
  hasDepartmentSection: true,
};

function scored(
  sectionCode: string,
  score: number,
  points = score,
  extra: Partial<PlacementScoredItem> = {},
): PlacementScoredItem {
  return {
    sectionCode,
    type: "choice",
    points,
    score,
    domainCode: extra.domainCode ?? null,
    departmentId: extra.departmentId ?? null,
    ...extra,
  };
}

function distributeCountableScores(
  targetTotal: number,
  safety: number,
  prompting: number,
): { knowledge: number; department: number; workflow: number; safety: number } {
  let remaining = targetTotal - safety - prompting;
  const workflow = Math.min(10, Math.max(0, remaining));
  remaining -= workflow;
  const department = Math.min(25, Math.max(0, remaining));
  remaining -= department;
  const knowledge = Math.min(25, Math.max(0, remaining));
  remaining -= knowledge;

  const caps = { knowledge: 25, department: 25, workflow: 10, safety: 15 };
  const scores = { knowledge, department, workflow, safety };

  for (const key of ["workflow", "department", "knowledge", "safety"] as const) {
    while (remaining > 0 && scores[key] < caps[key]) {
      scores[key] += 1;
      remaining -= 1;
    }
  }

  return {
    knowledge: scores.knowledge,
    department: scores.department,
    workflow: scores.workflow,
    safety: scores.safety,
  };
}

/** Scores that pass gates and hit a target total across counting sections. */
function itemsForTotal(
  total: number,
  overrides: {
    safety?: number;
    prompting?: number;
    technical?: number;
    technicalDomain?: { code: string; earned: number; available: number };
  } = {},
): PlacementScoredItem[] {
  const prompting = overrides.prompting ?? settings.gates.prompting_min_for_practitioner;
  const safetySeed = overrides.safety ?? settings.gates.safety_min_else_foundation;
  const split = distributeCountableScores(total, safetySeed, prompting);

  const items: PlacementScoredItem[] = [
    scored("knowledge", split.knowledge, 25),
    scored("prompting", prompting, 25),
    scored("department", split.department, 25, {
      departmentId: DEPT_CONTENT,
    }),
    scored("safety", split.safety, 15),
    scored("workflow", split.workflow, 10),
  ];

  if (overrides.technical !== undefined) {
    items.push(scored("technical", overrides.technical, 50));
  }

  if (overrides.technicalDomain) {
    const { code, earned, available } = overrides.technicalDomain;
    items.push(scored("technical", earned, available, { domainCode: code }));
  }

  return items;
}

describe("placement band boundaries", () => {
  it.each([
    [44, "foundation"],
    [45, "practitioner"],
    [69, "practitioner"],
    [70, "practitioner_fast_track"],
    [84, "practitioner_fast_track"],
    [85, "champion"],
  ] as const)("total %i suggests %s when gates pass", (total, stream) => {
    const result = computePlacement({
      ...baseInput,
      items: itemsForTotal(total),
    });
    expect(result.suggestedStream).toBe(stream);
    expect(result.gatesFailed).toEqual([]);
  });
});

describe("placement gates", () => {
  it("fails safety one point below the configured gate", () => {
    const gate = settings.gates.safety_min_else_foundation;
    const below = gate - 1;
    const result = computePlacement({
      ...baseInput,
      items: [
        ...itemsForTotal(70).filter((item) => item.sectionCode !== "safety"),
        scored("safety", below, 15),
      ],
    });
    expect(result.gatesFailed).toContain("safety");
    expect(result.suggestedStream).toBe("foundation");
  });

  it("passes safety at the configured gate", () => {
    const gate = settings.gates.safety_min_else_foundation;
    const result = computePlacement({
      ...baseInput,
      items: [
        ...itemsForTotal(70).filter((item) => item.sectionCode !== "safety"),
        scored("safety", gate, 15),
      ],
    });
    expect(result.gatesFailed).not.toContain("safety");
    expect(result.suggestedStream).toBe("practitioner_fast_track");
  });

  it("fails prompting one point below the configured gate", () => {
    const gate = settings.gates.prompting_min_for_practitioner;
    const result = computePlacement({
      ...baseInput,
      items: [
        ...itemsForTotal(70).filter((item) => item.sectionCode !== "prompting"),
        scored("prompting", gate - 1, 25),
      ],
    });
    expect(result.gatesFailed).toContain("prompting");
    expect(result.suggestedStream).toBe("foundation");
  });

  it("passes prompting at the configured gate", () => {
    const gate = settings.gates.prompting_min_for_practitioner;
    const result = computePlacement({
      ...baseInput,
      items: [
        ...itemsForTotal(70).filter((item) => item.sectionCode !== "prompting"),
        scored("prompting", gate, 25),
      ],
    });
    expect(result.gatesFailed).not.toContain("prompting");
  });
});

describe("domain percentage thresholds", () => {
  const practitionerBand = settings.bands.bands.find((band) => band.stream === "practitioner");
  const threshold =
    (practitionerBand as { bridges_for_domains_below_pct?: number }).bridges_for_domains_below_pct ??
    60;

  it("adds bridge modules below the practitioner band threshold", () => {
    const result = computePlacement({
      ...baseInput,
      items: itemsForTotal(50, {
        technicalDomain: { code: "C2", earned: threshold - 1, available: 100 },
      }),
    });
    expect(result.suggestedStream).toBe("practitioner");
    expect(result.bridges.length).toBeGreaterThan(0);
  });

  it("does not bridge at exactly the threshold percentage", () => {
    const result = computePlacement({
      ...baseInput,
      items: itemsForTotal(50, {
        technicalDomain: { code: "C2", earned: threshold, available: 100 },
      }),
    });
    expect(result.bridges).toEqual([]);
  });

  it("flags required domains under the threshold without changing stream", () => {
    const flags = computeRequiredDomainFlags(
      { C1: threshold - 1 },
      [{ domainCode: "C1", required: true }],
      threshold,
    );
    expect(flags).toEqual(["C1"]);
  });
});

describe("technical supplement", () => {
  it("is included in section scores but excluded from the total", () => {
    const result = computePlacement({
      ...baseInput,
      items: itemsForTotal(45, { technical: 40 }),
    });
    expect(result.sectionScores.technical).toBe(40);
    expect(result.total).toBe(45);
  });
});

describe("department item resolution", () => {
  it("uses Performance items when a sub-department has none", () => {
    const resolved = resolveDepartmentItemDepartmentId(
      DEPT_SEO,
      DEPT_PERFORMANCE,
      [DEPT_PERFORMANCE],
    );
    expect(resolved).toBe(DEPT_PERFORMANCE);

    const applies = itemAppliesToLearner(
      {
        sectionCode: "department",
        type: "practical",
        points: 25,
        score: 20,
        departmentId: DEPT_PERFORMANCE,
      },
      "department",
      resolved,
    );
    expect(applies).toBe(true);
  });

  it("blocks submit when no department task can be resolved", () => {
    const resolved = resolveDepartmentItemDepartmentId(DEPT_SEO, DEPT_PERFORMANCE, []);
    expect(resolved).toBeNull();
    expect(departmentSubmitBlockMessage(true, resolved)).toMatch(/Contact a trainer/);
  });
});

describe("bridge modules", () => {
  it("de-duplicates and orders by curriculum module order", () => {
    const practitionerThreshold =
      (settings.bands.bands.find((band) => band.stream === "practitioner") as {
        bridges_for_domains_below_pct?: number;
      }).bridges_for_domains_below_pct ?? 60;

    const result = computePlacement({
      ...baseInput,
      items: [
        ...itemsForTotal(50),
        scored("technical", practitionerThreshold - 1, 100, { domainCode: "C2" }),
        scored("technical", practitionerThreshold - 1, 100, { domainCode: "C3" }),
      ],
    });

    expect(result.bridges).toEqual(["F3", "F4", "F5"]);
  });
});

describe("champion candidacy", () => {
  it("suggests champion from band logic only (portfolio review is on confirm)", () => {
    const result = computePlacement({
      ...baseInput,
      items: itemsForTotal(85),
    });
    expect(result.suggestedStream).toBe("champion");
    expect(result.suggestedBand).toBe("champion");
  });
});
