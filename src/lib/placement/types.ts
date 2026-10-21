import type { Stream } from "@/lib/people/labels";
import type { PlacementBands, PlacementGates, Week0Sections } from "@/lib/settings/validators";

export type PlacementBridgeModules = {
  modules: Record<string, string[]>;
};

export type DepartmentDomainRequirement = {
  domainCode: string;
  required: boolean;
};

/** Settings snapshot inputs for placement calculation (mirrors app_settings keys). */
export type PlacementSettingsInput = {
  week0Sections: Week0Sections;
  gates: PlacementGates;
  bands: PlacementBands;
  bridgeModules: PlacementBridgeModules;
  /** Required domains for the learner's department only. */
  departmentRequirements: DepartmentDomainRequirement[];
};

export type PlacementItemType = "profile" | "choice" | "short_text" | "practical";

export type PlacementScoredItem = {
  sectionCode: string;
  type: PlacementItemType;
  /** Maximum points on the item (for domain availability). */
  points: number;
  /** Points earned (auto or marker score). */
  score: number;
  domainCode?: string | null;
  departmentId?: string | null;
};

export type ModuleSortKey = {
  code: string;
  stageSortOrder: number;
  moduleSortOrder: number;
};

export type ComputePlacementInput = {
  settings: PlacementSettingsInput;
  items: PlacementScoredItem[];
  userDepartmentId: string | null;
  parentDepartmentId: string | null;
  /** Department ids that have at least one item in the assessment department section. */
  departmentIdsWithDepartmentItems: string[];
  /** Curriculum order used to sort bridge module codes. */
  moduleOrder: ModuleSortKey[];
  hasDepartmentSection: boolean;
};

export type PlacementComputation = {
  sectionScores: Record<string, number>;
  total: number;
  domainPercentages: Record<string, number>;
  suggestedBand: string | null;
  suggestedStream: Stream;
  gatesFailed: string[];
  bridges: string[];
  requiredDomainFlags: string[];
};
