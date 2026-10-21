import type { Stream } from "@/lib/people/labels";
import { streamValues } from "@/lib/people/labels";
import { defaultPlanStreamRules } from "@/lib/plan/stream-rules";
import type { PlanStreamRules, StreamRuleBlock, TestOutRule } from "@/lib/plan/types";

/** Shape stored in app_settings under plan.stream_rules (DL-027). */
export type PlanStreamRulesStreamBlock = {
  required: string[];
  tested_out: string[];
  optional: string[];
  test_outs: TestOutRule[];
  specialist_eligible?: boolean;
};

export type PlanStreamRulesSetting = {
  bridge_due_week: number;
  senior_management_department_code: string;
  streams: Record<Stream, PlanStreamRulesStreamBlock>;
};

const streamList = streamValues;

function blockToSetting(block: StreamRuleBlock): PlanStreamRulesStreamBlock {
  return {
    required: block.required,
    tested_out: block.tested_out,
    optional: block.optional,
    test_outs: block.test_outs,
    ...(block.specialist_eligible ? { specialist_eligible: true } : {}),
  };
}

export function defaultPlanStreamRulesSetting(): PlanStreamRulesSetting {
  return {
    bridge_due_week: defaultPlanStreamRules.bridge_due_week,
    senior_management_department_code: "senior-management",
    streams: {
      foundation: blockToSetting(defaultPlanStreamRules.foundation),
      practitioner: blockToSetting(defaultPlanStreamRules.practitioner),
      practitioner_fast_track: blockToSetting(defaultPlanStreamRules.practitioner_fast_track),
      champion: blockToSetting(defaultPlanStreamRules.champion),
    },
  };
}

function parseTestOuts(raw: unknown): TestOutRule[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const rules: TestOutRule[] = [];
  for (const entry of raw) {
    if (typeof entry !== "object" || entry === null) {
      continue;
    }
    const record = entry as Record<string, unknown>;
    const code = typeof record.code === "string" ? record.code : "";
    const via = record.via === "assignment" ? "assignment" : record.via === "assessment" ? "assessment" : null;
    const source_code = typeof record.source_code === "string" ? record.source_code : "";
    const week = typeof record.week === "number" ? record.week : null;
    const modules = Array.isArray(record.modules)
      ? record.modules.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
      : [];
    if (!code || !via || !source_code || week === null || modules.length === 0) {
      continue;
    }
    rules.push({ code, via, source_code, week, modules });
  }
  return rules;
}

function parseStreamBlock(
  block: unknown,
  stream: Stream,
  allModuleCodes: readonly string[],
  defaults: PlanStreamRulesStreamBlock,
): PlanStreamRulesStreamBlock {
  const record = typeof block === "object" && block !== null ? (block as Record<string, unknown>) : {};
  const tested_out = Array.isArray(record.tested_out)
    ? record.tested_out.filter((value): value is string => typeof value === "string")
    : defaults.tested_out;
  const optional = Array.isArray(record.optional)
    ? record.optional.filter((value): value is string => typeof value === "string")
    : defaults.optional;
  const test_outs = parseTestOuts(record.test_outs ?? defaults.test_outs);
  let required: string[];
  if (Array.isArray(record.required) && record.required.length > 0) {
    required = record.required.filter((value): value is string => typeof value === "string");
  } else {
    const tested = new Set(tested_out.map((code) => code.toUpperCase()));
    const opt = new Set(optional.map((code) => code.toUpperCase()));
    const inTestOut = new Set(
      test_outs.flatMap((rule) => rule.modules.map((code) => code.toUpperCase())),
    );
    required = [];
    for (const code of allModuleCodes) {
      const upper = code.toUpperCase();
      if (tested.has(upper) || opt.has(upper) || inTestOut.has(upper)) {
        continue;
      }
      required.push(code);
    }
  }
  const specialist_eligible =
    stream === "champion" && record.specialist_eligible === true ? true : undefined;
  return { required, tested_out, optional, test_outs, ...(specialist_eligible ? { specialist_eligible } : {}) };
}

function blockFromSettingRow(row: PlanStreamRulesStreamBlock): StreamRuleBlock {
  return {
    required: row.required,
    tested_out: row.tested_out,
    optional: row.optional,
    test_outs: row.test_outs,
    ...(row.specialist_eligible ? { specialist_eligible: true } : {}),
  };
}

/** Converts the database JSON into the full rule object used by pure functions. */
export function planStreamRulesFromSetting(
  value: unknown,
  allModuleCodes: readonly string[],
): PlanStreamRules | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const record = value as Record<string, unknown>;
  const streamsRaw = record.streams;
  if (typeof streamsRaw !== "object" || streamsRaw === null) {
    return null;
  }
  const defaults = defaultPlanStreamRulesSetting();
  const bridgeDue =
    typeof record.bridge_due_week === "number" ? record.bridge_due_week : defaultPlanStreamRules.bridge_due_week;
  const seniorCode =
    typeof record.senior_management_department_code === "string"
      ? record.senior_management_department_code
      : "senior-management";

  const setting: PlanStreamRulesSetting = {
    bridge_due_week: bridgeDue,
    senior_management_department_code: seniorCode,
    streams: {} as PlanStreamRulesSetting["streams"],
  };

  for (const stream of streamList) {
    const block = (streamsRaw as Record<string, unknown>)[stream];
    setting.streams[stream] = parseStreamBlock(block, stream, allModuleCodes, defaults.streams[stream]);
  }

  return {
    foundation: blockFromSettingRow(setting.streams.foundation),
    practitioner: blockFromSettingRow(setting.streams.practitioner),
    practitioner_fast_track: blockFromSettingRow(setting.streams.practitioner_fast_track),
    champion: blockFromSettingRow(setting.streams.champion),
    bridge_due_week: setting.bridge_due_week,
    leadership_required_department_codes: [setting.senior_management_department_code],
  };
}

export function planStreamRulesToSetting(rules: PlanStreamRules): PlanStreamRulesSetting {
  return {
    bridge_due_week: rules.bridge_due_week,
    senior_management_department_code: rules.leadership_required_department_codes[0] ?? "senior-management",
    streams: {
      foundation: blockToSetting(rules.foundation),
      practitioner: blockToSetting(rules.practitioner),
      practitioner_fast_track: blockToSetting(rules.practitioner_fast_track),
      champion: blockToSetting(rules.champion),
    },
  };
}
