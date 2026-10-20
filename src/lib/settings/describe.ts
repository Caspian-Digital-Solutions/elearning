import { streamNames, isOneOf, streamValues } from "@/lib/people/labels";
import type { Json } from "@/lib/settings/validators";

export const settingNames: Record<string, string> = {
  "placement.gates": "Placement gates",
  "placement.bands": "Placement bands",
  "placement.week0_sections": "Week-0 sections",
  "certification.foundation": "Foundation certification",
  "certification.department": "Department certification",
};

export function settingName(key: string): string {
  return settingNames[key] ?? key;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function streamName(value: unknown): string {
  return isOneOf(streamValues, value) ? streamNames[value] : String(value);
}

/** One short line describing a setting's value, for lists and previews. */
export function summariseSetting(key: string, value: Json | unknown): string {
  if (!isRecord(value)) {
    return JSON.stringify(value) ?? "Empty";
  }
  switch (key) {
    case "placement.gates":
      return `Safety gate ${value.safety_min_else_foundation}; Prompting gate ${value.prompting_min_for_practitioner}`;
    case "placement.bands":
      if (Array.isArray(value.bands)) {
        return value.bands
          .filter(isRecord)
          .map((band) => `${band.min}–${band.max} ${streamName(band.stream)}`)
          .join("; ");
      }
      break;
    case "placement.week0_sections":
      if (Array.isArray(value.sections)) {
        return value.sections
          .filter(isRecord)
          .map((section) => `${section.name} ${section.max ?? "no max"}${section.counts_in_total ? "" : " (not counted)"}`)
          .join("; ");
      }
      break;
    case "certification.foundation":
      return `Overall at least ${value.overall_min_pct}%; safety quiz pass ${value.safety_quiz_pass_pct}%${
        value.safety_quiz_must_pass ? ", must pass" : ""
      }`;
    case "certification.department":
      return `${value.live_use_weeks_required} weeks of live use`;
  }
  const text = JSON.stringify(value);
  return text.length > 120 ? `${text.slice(0, 117)}...` : text;
}
