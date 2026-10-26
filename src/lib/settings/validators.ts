import { z } from "zod";
import { streamNames, streamValues, type Stream } from "@/lib/people/labels";
import { streamRulesForbidF3TestOut } from "@/lib/plan/stream-rules";
import {
  defaultPlanStreamRulesSetting,
  planStreamRulesFromSetting,
  type PlanStreamRulesSetting,
} from "@/lib/plan/stream-rules-setting";

/**
 * Checks for the programme settings in app_settings. The numbers themselves
 * live in the database; these functions only check that a new value is
 * complete and consistent before an admin saves it.
 */

export type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

export type CheckResult<T> = { ok: true; value: T } | { ok: false; errors: string[] };

export const knownSettingKeys = [
  "placement.gates",
  "placement.bands",
  "placement.week0_sections",
  "placement.bridge_modules",
  "plan.stream_rules",
  "certification.foundation",
  "certification.department",
  "marking.double_mark_sample_pct",
  "marking.difference_threshold_pct",
  "marking.target_working_days",
  "skills.min_test_cases",
] as const;

export type KnownSettingKey = (typeof knownSettingKeys)[number];

export function isKnownSettingKey(key: string): key is KnownSettingKey {
  return (knownSettingKeys as readonly string[]).includes(key);
}

const wholeNumber = (label: string) =>
  z.number({ error: `${label} must be a whole number.` }).int({ error: `${label} must be a whole number.` });

const percentage = (label: string) =>
  wholeNumber(label)
    .min(0, { error: `${label} must be between 0 and 100.` })
    .max(100, { error: `${label} must be between 0 and 100.` });

function zodErrors(error: z.ZodError): string[] {
  return [...new Set(error.issues.map((issue) => issue.message))];
}

// Week-0 sections ----------------------------------------------------------

const sectionSchema = z.looseObject({
  code: z.string({ error: "Every section needs a code." }).min(1, { error: "Every section needs a code." }),
  name: z.string({ error: "Every section needs a name." }).min(1, { error: "Every section needs a name." }),
  max: wholeNumber("A section maximum").min(0, { error: "A section maximum cannot be negative." }).nullable(),
  counts_in_total: z.boolean({ error: "Say whether each section counts in the total." }),
});

const week0SectionsSchema = z.looseObject({
  sections: z.array(sectionSchema, { error: "The value must list the sections." }).min(1, {
    error: "List at least one section.",
  }),
});

export type Week0Section = z.infer<typeof sectionSchema>;
export type Week0Sections = z.infer<typeof week0SectionsSchema>;

export function sectionMaximum(sections: Week0Sections, code: string): number | null {
  return sections.sections.find((section) => section.code === code)?.max ?? null;
}

export function checkWeek0Sections(value: unknown, currentGates?: unknown): CheckResult<Week0Sections> {
  const parsed = week0SectionsSchema.safeParse(value);
  if (!parsed.success) {
    return { ok: false, errors: zodErrors(parsed.error) };
  }
  const errors: string[] = [];
  const sections = parsed.data.sections;

  const codes = sections.map((section) => section.code);
  if (new Set(codes).size !== codes.length) {
    errors.push("Each section code must be used once.");
  }

  const counted = sections.filter((section) => section.counts_in_total);
  for (const section of counted) {
    if (section.max === null) {
      errors.push(`${section.name} counts in the total, so it needs a maximum.`);
    }
  }
  const total = counted.reduce((sum, section) => sum + (section.max ?? 0), 0);
  if (total !== 100) {
    errors.push(`The sections that count in the total must add up to 100. They add up to ${total}.`);
  }

  for (const code of ["safety", "prompting"]) {
    if (!sections.some((section) => section.code === code)) {
      errors.push(`The ${code === "safety" ? "Safety" : "Prompting"} section is needed by the placement gates.`);
    }
  }

  if (errors.length === 0 && currentGates !== undefined) {
    const gates = checkGates(currentGates, parsed.data);
    if (!gates.ok) {
      errors.push(...gates.errors.map((error) => `${error} Change the placement gates first.`));
    }
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true, value: parsed.data };
}

// Placement gates ----------------------------------------------------------

const gatesSchema = z.looseObject({
  safety_min_else_foundation: wholeNumber("The Safety gate"),
  prompting_min_for_practitioner: wholeNumber("The Prompting gate"),
});

export type PlacementGates = z.infer<typeof gatesSchema>;

export function checkGates(value: unknown, sectionsValue: unknown): CheckResult<PlacementGates> {
  const parsed = gatesSchema.safeParse(value);
  if (!parsed.success) {
    return { ok: false, errors: zodErrors(parsed.error) };
  }
  const sections = week0SectionsSchema.safeParse(sectionsValue);
  if (!sections.success) {
    return { ok: false, errors: ["The Week-0 sections setting is not valid, so the gates cannot be checked."] };
  }

  const errors: string[] = [];
  const limits = [
    ["The Safety gate", parsed.data.safety_min_else_foundation, sectionMaximum(sections.data, "safety"), "Safety"],
    ["The Prompting gate", parsed.data.prompting_min_for_practitioner, sectionMaximum(sections.data, "prompting"), "Prompting"],
  ] as const;
  for (const [label, gate, maximum, sectionName] of limits) {
    if (maximum === null) {
      errors.push(`The ${sectionName} section has no maximum, so ${label.toLowerCase()} cannot be checked.`);
    } else if (gate < 0 || gate > maximum) {
      errors.push(`${label} must be between 0 and the ${sectionName} section maximum (${maximum}).`);
    }
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true, value: parsed.data };
}

// Placement bands ----------------------------------------------------------

const streamSchema = z.enum(streamValues, {
  error: `Each band's stream must be one of: ${streamValues.map((stream) => streamNames[stream]).join(", ")}.`,
});

const bandSchema = z.looseObject({
  min: wholeNumber("A band's minimum"),
  max: wholeNumber("A band's maximum"),
  stream: streamSchema,
});

const bandsSchema = z.looseObject({
  bands: z.array(bandSchema, { error: "The value must list the bands." }).min(1, { error: "List at least one band." }),
});

export type PlacementBand = z.infer<typeof bandSchema> & { stream: Stream };
export type PlacementBands = z.infer<typeof bandsSchema>;

export function checkBands(value: unknown): CheckResult<PlacementBands> {
  const parsed = bandsSchema.safeParse(value);
  if (!parsed.success) {
    return { ok: false, errors: zodErrors(parsed.error) };
  }
  const errors: string[] = [];
  const bands = [...parsed.data.bands].sort((left, right) => left.min - right.min || left.max - right.max);

  for (const band of bands) {
    if (band.min > band.max) {
      errors.push(`The band ${band.min} to ${band.max} has a minimum above its maximum.`);
    }
    if (band.min < 0 || band.max > 100) {
      errors.push(`The band ${band.min} to ${band.max} goes outside 0 to 100.`);
    }
  }

  if (bands[0].min !== 0) {
    errors.push(`The bands must start at 0. The lowest band starts at ${bands[0].min}.`);
  }
  const last = bands[bands.length - 1];
  if (last.max !== 100) {
    errors.push(`The bands must end at 100. The highest band ends at ${last.max}.`);
  }

  for (let index = 1; index < bands.length; index += 1) {
    const previous = bands[index - 1];
    const current = bands[index];
    if (current.min > previous.max + 1) {
      errors.push(`There is a gap between ${previous.max} and ${current.min}: scores ${previous.max + 1} to ${current.min - 1} have no band.`);
    } else if (current.min <= previous.max) {
      errors.push(`The bands ${previous.min} to ${previous.max} and ${current.min} to ${current.max} overlap.`);
    }
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true, value: { ...parsed.data, bands } };
}

// Bridge modules -----------------------------------------------------------

const bridgeModulesSchema = z.looseObject({
  modules: z.record(
    z.string(),
    z.array(z.string().trim().min(1, { error: "Every module code must be non-empty." })),
    { error: "List module codes for each domain." },
  ),
});

export type PlacementBridgeModulesSetting = z.infer<typeof bridgeModulesSchema>;

export function checkBridgeModules(
  value: unknown,
  moduleCodes: readonly string[],
): CheckResult<PlacementBridgeModulesSetting> {
  const parsed = bridgeModulesSchema.safeParse(value);
  if (!parsed.success) {
    return { ok: false, errors: zodErrors(parsed.error) };
  }
  const errors: string[] = [];
  const knownModules = new Set(moduleCodes.map((code) => code.toUpperCase()));
  for (const [domain, codes] of Object.entries(parsed.data.modules)) {
    if (!/^C[1-9]$/.test(domain)) {
      errors.push(`Domain "${domain}" must be a competency code from C1 to C9.`);
    }
    for (const code of codes) {
      if (!knownModules.has(code.toUpperCase())) {
        errors.push(`Module "${code}" for ${domain} is not in the programme.`);
      }
    }
  }
  return errors.length > 0 ? { ok: false, errors } : { ok: true, value: parsed.data };
}

// Plan stream rules --------------------------------------------------------

const testOutRuleSchema = z.looseObject({
  code: z.string().trim().min(1),
  modules: z.array(z.string().trim().min(1)).min(1),
  via: z.enum(["assessment", "assignment"]),
  source_code: z.string().trim().min(1),
  week: wholeNumber("Test-out week").min(0).max(12),
});

const planStreamBlockSchema = z.looseObject({
  required: z.array(z.string().trim().min(1)).optional(),
  tested_out: z.array(z.string().trim().min(1)),
  optional: z.array(z.string().trim().min(1)),
  test_outs: z.array(testOutRuleSchema).optional(),
  specialist_eligible: z.boolean().optional(),
});

const planStreamRulesSchema = z.looseObject({
  bridge_due_week: wholeNumber("Bridge due week").min(0).max(12),
  senior_management_department_code: z.string().trim().min(1),
  streams: z.record(z.string(), planStreamBlockSchema),
});

export function checkPlanStreamRules(
  value: unknown,
  moduleCodes: readonly string[],
): CheckResult<PlanStreamRulesSetting> {
  const parsed = planStreamRulesSchema.safeParse(value);
  if (!parsed.success) {
    return { ok: false, errors: zodErrors(parsed.error) };
  }
  const errors: string[] = [];
  const known = new Set(moduleCodes.map((code) => code.toUpperCase()));
  for (const stream of streamValues) {
    const block = parsed.data.streams[stream];
    if (!block) {
      errors.push(`The ${streamNames[stream]} stream is missing from plan.stream_rules.`);
      continue;
    }
    const lists = [block.tested_out, block.optional, ...(block.required ?? [])];
    for (const list of lists) {
      for (const code of list) {
        if (!known.has(code.toUpperCase())) {
          errors.push(`Module "${code}" is not in the programme.`);
        }
      }
    }
    for (const rule of block.test_outs ?? []) {
      for (const code of rule.modules) {
        if (!known.has(code.toUpperCase())) {
          errors.push(`Module "${code}" in test-out "${rule.code}" is not in the programme.`);
        }
      }
      if (rule.via === "assessment" && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(rule.source_code)) {
        errors.push(`Test-out "${rule.code}" needs a valid assessment source code.`);
      }
    }
    if (block.tested_out.some((code) => code.toUpperCase() === "F3")) {
      errors.push("F3 cannot be listed as tested out for any stream.");
    }
    if (block.optional.some((code) => code.toUpperCase() === "F3")) {
      errors.push("F3 cannot be listed as optional for any stream.");
    }
  }
  const fullRules = planStreamRulesFromSetting(parsed.data, moduleCodes);
  if (fullRules && streamRulesForbidF3TestOut(fullRules)) {
    errors.push("F3 cannot be tested out for any stream.");
  }
  if (errors.length > 0) {
    return { ok: false, errors };
  }
  const defaults = defaultPlanStreamRulesSetting();
  const streams: PlanStreamRulesSetting["streams"] = {} as PlanStreamRulesSetting["streams"];
  for (const stream of streamValues) {
    const block = parsed.data.streams[stream]!;
    const def = defaults.streams[stream];
    streams[stream] = {
      required: block.required ?? def.required,
      tested_out: block.tested_out,
      optional: block.optional,
      test_outs: block.test_outs ?? def.test_outs,
      ...(stream === "champion" && block.specialist_eligible ? { specialist_eligible: true } : {}),
    };
  }
  return {
    ok: true,
    value: {
      bridge_due_week: parsed.data.bridge_due_week,
      senior_management_department_code: parsed.data.senior_management_department_code,
      streams,
    },
  };
}

// Certification ------------------------------------------------------------

const foundationSchema = z.looseObject({
  overall_min_pct: percentage("The overall minimum"),
  safety_quiz_pass_pct: percentage("The safety quiz pass mark"),
  safety_quiz_must_pass: z.boolean({ error: "Say whether the safety quiz must be passed." }),
});

const departmentSchema = z.looseObject({
  live_use_weeks_required: wholeNumber("Weeks of live use")
    .min(1, { error: "Weeks of live use must be between 1 and 12." })
    .max(12, { error: "Weeks of live use must be between 1 and 12." }),
});

export type FoundationCertification = z.infer<typeof foundationSchema>;
export type DepartmentCertification = z.infer<typeof departmentSchema>;

export function checkFoundationCertification(value: unknown): CheckResult<FoundationCertification> {
  const parsed = foundationSchema.safeParse(value);
  return parsed.success ? { ok: true, value: parsed.data } : { ok: false, errors: zodErrors(parsed.error) };
}

export function checkDepartmentCertification(value: unknown): CheckResult<DepartmentCertification> {
  const parsed = departmentSchema.safeParse(value);
  return parsed.success ? { ok: true, value: parsed.data } : { ok: false, errors: zodErrors(parsed.error) };
}

const markingPctSchema = percentage("Sample percentage");
const markingThresholdSchema = percentage("Difference threshold");
const markingDaysSchema = wholeNumber("Target working days").min(1, {
  error: "Target working days must be at least 1.",
});

export function checkMarkingDoubleMarkSamplePct(value: unknown): CheckResult<number> {
  const parsed = markingPctSchema.safeParse(
    typeof value === "number" ? value : Number(typeof value === "string" ? value : NaN),
  );
  return parsed.success ? { ok: true, value: parsed.data } : { ok: false, errors: zodErrors(parsed.error) };
}

export function checkMarkingDifferenceThresholdPct(value: unknown): CheckResult<number> {
  const parsed = markingThresholdSchema.safeParse(
    typeof value === "number" ? value : Number(typeof value === "string" ? value : NaN),
  );
  return parsed.success ? { ok: true, value: parsed.data } : { ok: false, errors: zodErrors(parsed.error) };
}

export function checkMarkingTargetWorkingDays(value: unknown): CheckResult<number> {
  const parsed = markingDaysSchema.safeParse(
    typeof value === "number" ? value : Number(typeof value === "string" ? value : NaN),
  );
  return parsed.success ? { ok: true, value: parsed.data } : { ok: false, errors: zodErrors(parsed.error) };
}

const minTestCasesSchema = wholeNumber("Minimum test cases")
  .min(1, { error: "Minimum test cases must be at least 1." })
  .max(50, { error: "Minimum test cases must be at most 50." });

export function checkSkillsMinTestCases(value: unknown): CheckResult<number> {
  const parsed = minTestCasesSchema.safeParse(
    typeof value === "number" ? value : Number(typeof value === "string" ? value : NaN),
  );
  return parsed.success ? { ok: true, value: parsed.data } : { ok: false, errors: zodErrors(parsed.error) };
}

// Any setting --------------------------------------------------------------

/**
 * Checks a new value for any setting. `current` holds the saved values of the
 * other settings, so related settings stay consistent (gates against section maxima).
 */
export function checkSetting(
  key: string,
  value: unknown,
  current: Record<string, unknown>,
  moduleCodes?: readonly string[],
): CheckResult<Json> {
  const asJson = (result: CheckResult<unknown>): CheckResult<Json> =>
    result.ok ? { ok: true, value: value as Json } : result;

  switch (key) {
    case "placement.gates":
      return asJson(checkGates(value, current["placement.week0_sections"]));
    case "placement.bands":
      return asJson(checkBands(value));
    case "placement.week0_sections":
      return asJson(checkWeek0Sections(value, current["placement.gates"]));
    case "placement.bridge_modules":
      if (!moduleCodes?.length) {
        return { ok: false, errors: ["Module codes could not be loaded to validate bridge modules."] };
      }
      return asJson(checkBridgeModules(value, moduleCodes));
    case "plan.stream_rules":
      if (!moduleCodes?.length) {
        return { ok: false, errors: ["Module codes could not be loaded to validate plan stream rules."] };
      }
      return asJson(checkPlanStreamRules(value, moduleCodes));
    case "certification.foundation":
      return asJson(checkFoundationCertification(value));
    case "certification.department":
      return asJson(checkDepartmentCertification(value));
    case "marking.double_mark_sample_pct":
      return asJson(checkMarkingDoubleMarkSamplePct(value));
    case "marking.difference_threshold_pct":
      return asJson(checkMarkingDifferenceThresholdPct(value));
    case "marking.target_working_days":
      return asJson(checkMarkingTargetWorkingDays(value));
    case "skills.min_test_cases":
      return asJson(checkSkillsMinTestCases(value));
    default:
      return value === undefined ? { ok: false, errors: ["The new value is empty."] } : { ok: true, value: value as Json };
  }
}

/** Reads JSON typed by a person. Refuses anything that is not valid JSON. */
export function parseJsonText(text: string): CheckResult<Json> {
  if (text.trim() === "") {
    return { ok: false, errors: ["Enter a JSON value."] };
  }
  try {
    return { ok: true, value: JSON.parse(text) as Json };
  } catch (error) {
    const detail = error instanceof Error ? ` (${error.message})` : "";
    return { ok: false, errors: [`That is not valid JSON${detail}.`] };
  }
}

/** A reason is required for every setting and role change. */
export function checkReason(reason: unknown): CheckResult<string> {
  const text = typeof reason === "string" ? reason.trim() : "";
  if (text.length < 10) {
    return { ok: false, errors: ["Give a reason of at least 10 characters."] };
  }
  if (text.length > 500) {
    return { ok: false, errors: ["Keep the reason under 500 characters."] };
  }
  return { ok: true, value: text };
}
