import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { PlacementBridgeModules, PlacementSettingsInput } from "../types";
import type { PlacementBands, PlacementGates, Week0Sections } from "@/lib/settings/validators";

type CurriculumAppSettings = {
  "placement.week0_sections": Week0Sections & { note?: string };
  "placement.gates": PlacementGates & { note?: string };
  "placement.bands": PlacementBands & { note?: string };
};

const curriculumPath = resolve("docs/seed/curriculum_v1_1.json");

const bridgeModulesDefault: PlacementBridgeModules = {
  modules: {
    C1: ["F1", "F2"],
    C2: ["F4", "F5"],
    C3: ["F3", "F5"],
    C4: ["F3"],
    C5: ["F2", "F8"],
  },
};

/** Default placement settings from `docs/seed/curriculum_v1_1.json` (plus bridge_modules from migration seed). */
export function loadDefaultPlacementSettings(
  departmentRequirements: PlacementSettingsInput["departmentRequirements"] = [],
): PlacementSettingsInput {
  const raw = JSON.parse(readFileSync(curriculumPath, "utf8")) as {
    app_settings: CurriculumAppSettings;
  };
  const app = raw.app_settings;

  return {
    week0Sections: {
      sections: app["placement.week0_sections"].sections,
    },
    gates: {
      safety_min_else_foundation: app["placement.gates"].safety_min_else_foundation,
      prompting_min_for_practitioner: app["placement.gates"].prompting_min_for_practitioner,
    },
    bands: {
      bands: app["placement.bands"].bands,
    },
    bridgeModules: bridgeModulesDefault,
    departmentRequirements,
  };
}

/** Foundation-stage module order for bridge sorting tests (matches curriculum seed). */
export const foundationModuleOrder = [
  { code: "F1", stageSortOrder: 1, moduleSortOrder: 1 },
  { code: "F2", stageSortOrder: 1, moduleSortOrder: 2 },
  { code: "F3", stageSortOrder: 1, moduleSortOrder: 3 },
  { code: "F4", stageSortOrder: 1, moduleSortOrder: 4 },
  { code: "F5", stageSortOrder: 1, moduleSortOrder: 5 },
  { code: "F8", stageSortOrder: 1, moduleSortOrder: 8 },
] as const;
