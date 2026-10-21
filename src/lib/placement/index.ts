export { computePlacement } from "./compute-placement";
export { matchBand, bridgeThresholdForPlacement } from "./band";
export { computeBridgeModules } from "./bridges";
export { computeDomainPercentages } from "./domain-percentages";
export { evaluateGates } from "./gates";
export { itemAppliesToLearner } from "./item-applies";
export { computeRequiredDomainFlags } from "./required-domain-flags";
export {
  departmentSubmitBlockMessage,
  resolveDepartmentItemDepartmentId,
} from "./resolve-department";
export { computeSectionScores, computeTotal } from "./section-scores";
export type {
  ComputePlacementInput,
  DepartmentDomainRequirement,
  ModuleSortKey,
  PlacementBridgeModules,
  PlacementComputation,
  PlacementScoredItem,
  PlacementSettingsInput,
} from "./types";
export { foundationModuleOrder, loadDefaultPlacementSettings } from "./fixtures/default-settings";
