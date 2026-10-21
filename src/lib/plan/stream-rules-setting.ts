import type { Stream } from "@/lib/people/labels";
import { streamValues } from "@/lib/people/labels";
import { defaultPlanStreamRules } from "@/lib/plan/stream-rules";
import type { PlanStreamRules, StreamRuleBlock } from "@/lib/plan/types";

/** Shape stored in app_settings under plan.stream_rules. */
export type PlanStreamRulesSetting = {
  bridge_due_week: number;
  senior_management_department_code: string;
  streams: Record<
    Stream,
    {
      tested_out: string[];
      optional: string[];
    }
  >;
};

const streamList = streamValues;

export function defaultPlanStreamRulesSetting(): PlanStreamRulesSetting {
  return {
    bridge_due_week: defaultPlanStreamRules.bridge_due_week,
    senior_management_department_code: "senior-management",
    streams: {
      foundation: {
        tested_out: defaultPlanStreamRules.foundation.tested_out,
        optional: defaultPlanStreamRules.foundation.optional,
      },
      practitioner: {
        tested_out: defaultPlanStreamRules.practitioner.tested_out,
        optional: defaultPlanStreamRules.practitioner.optional,
      },
      practitioner_fast_track: {
        tested_out: defaultPlanStreamRules.practitioner_fast_track.tested_out,
        optional: defaultPlanStreamRules.practitioner_fast_track.optional,
      },
      champion: {
        tested_out: defaultPlanStreamRules.champion.tested_out,
        optional: defaultPlanStreamRules.champion.optional,
      },
    },
  };
}

function blockFromSetting(
  stream: Stream,
  setting: PlanStreamRulesSetting,
  allModuleCodes: readonly string[],
): StreamRuleBlock {
  const row = setting.streams[stream];
  const tested = new Set(row.tested_out.map((code) => code.toUpperCase()));
  const optional = new Set(row.optional.map((code) => code.toUpperCase()));
  const required: string[] = [];
  for (const code of allModuleCodes) {
    const upper = code.toUpperCase();
    if (tested.has(upper) || optional.has(upper)) {
      continue;
    }
    required.push(code);
  }
  return {
    required,
    tested_out: row.tested_out,
    optional: row.optional,
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
    const tested =
      typeof block === "object" && block !== null && Array.isArray((block as { tested_out?: unknown }).tested_out)
        ? ((block as { tested_out: string[] }).tested_out ?? [])
        : [];
    const optional =
      typeof block === "object" && block !== null && Array.isArray((block as { optional?: unknown }).optional)
        ? ((block as { optional: string[] }).optional ?? [])
        : [];
    setting.streams[stream] = { tested_out: tested, optional };
  }

  return {
    foundation: blockFromSetting("foundation", setting, allModuleCodes),
    practitioner: blockFromSetting("practitioner", setting, allModuleCodes),
    practitioner_fast_track: blockFromSetting("practitioner_fast_track", setting, allModuleCodes),
    champion: blockFromSetting("champion", setting, allModuleCodes),
    bridge_due_week: setting.bridge_due_week,
    leadership_required_department_codes: [setting.senior_management_department_code],
  };
}

export function planStreamRulesToSetting(rules: PlanStreamRules): PlanStreamRulesSetting {
  return {
    bridge_due_week: rules.bridge_due_week,
    senior_management_department_code: rules.leadership_required_department_codes[0] ?? "senior-management",
    streams: {
      foundation: {
        tested_out: rules.foundation.tested_out,
        optional: rules.foundation.optional,
      },
      practitioner: {
        tested_out: rules.practitioner.tested_out,
        optional: rules.practitioner.optional,
      },
      practitioner_fast_track: {
        tested_out: rules.practitioner_fast_track.tested_out,
        optional: rules.practitioner_fast_track.optional,
      },
      champion: {
        tested_out: rules.champion.tested_out,
        optional: rules.champion.optional,
      },
    },
  };
}
