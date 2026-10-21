import type { DepartmentDomainRequirement } from "./types";

export function computeRequiredDomainFlags(
  domainPercentages: Record<string, number>,
  requirements: DepartmentDomainRequirement[],
  bridgeThresholdPct: number,
): string[] {
  const flags: string[] = [];
  for (const requirement of requirements) {
    if (!requirement.required) {
      continue;
    }
    const pct = domainPercentages[requirement.domainCode] ?? 0;
    if (pct < bridgeThresholdPct) {
      flags.push(requirement.domainCode);
    }
  }
  return flags;
}
