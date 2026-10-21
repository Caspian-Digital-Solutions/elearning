import { bridgeThresholdForPlacement, matchBand } from "./band";
import { computeBridgeModules } from "./bridges";
import { computeDomainPercentages } from "./domain-percentages";
import { evaluateGates } from "./gates";
import { computeRequiredDomainFlags } from "./required-domain-flags";
import { resolveDepartmentItemDepartmentId } from "./resolve-department";
import { computeSectionScores, computeTotal } from "./section-scores";
import type { ComputePlacementInput, PlacementComputation } from "./types";

export function computePlacement(input: ComputePlacementInput): PlacementComputation {
  const { settings, items, moduleOrder, hasDepartmentSection } = input;

  const departmentMatchId = resolveDepartmentItemDepartmentId(
    input.userDepartmentId,
    input.parentDepartmentId,
    input.departmentIdsWithDepartmentItems,
  );

  if (hasDepartmentSection && departmentMatchId === null && input.userDepartmentId !== null) {
    // Calculation can still run with zero department points; submit is blocked separately.
  }

  const sectionScores = computeSectionScores(settings.week0Sections, items, departmentMatchId);
  const total = computeTotal(settings.week0Sections, sectionScores);
  const domainPercentages = computeDomainPercentages(items, departmentMatchId);
  const gatesFailed = evaluateGates(settings.gates, sectionScores);

  let suggestedBand: string | null = null;
  let suggestedStream = "foundation" as PlacementComputation["suggestedStream"];

  if (gatesFailed.length > 0) {
    suggestedBand = "foundation";
    suggestedStream = "foundation";
  } else {
    const band = matchBand(total, settings.bands);
    if (band) {
      suggestedBand = band.suggestedBand;
      suggestedStream = band.suggestedStream;
    }
  }

  const bridgeThresholdPct = bridgeThresholdForPlacement(
    total,
    settings.bands,
    gatesFailed,
  );

  const bridges = computeBridgeModules(
    suggestedStream,
    domainPercentages,
    settings.bridgeModules,
    bridgeThresholdPct,
    moduleOrder,
  );

  const requiredDomainFlags = computeRequiredDomainFlags(
    domainPercentages,
    settings.departmentRequirements,
    bridgeThresholdPct,
  );

  return {
    sectionScores,
    total,
    domainPercentages,
    suggestedBand,
    suggestedStream,
    gatesFailed,
    bridges,
    requiredDomainFlags,
  };
}
