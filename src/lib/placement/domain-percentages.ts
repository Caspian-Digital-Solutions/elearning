import { itemAppliesToLearner } from "./item-applies";
import type { PlacementScoredItem } from "./types";

export function computeDomainPercentages(
  items: PlacementScoredItem[],
  departmentMatchId: string | null,
): Record<string, number> {
  const earned: Record<string, number> = {};
  const available: Record<string, number> = {};

  for (const item of items) {
    if (!itemAppliesToLearner(item, item.sectionCode, departmentMatchId)) {
      continue;
    }
    if (item.type === "profile" || !item.domainCode) {
      continue;
    }

    const code = item.domainCode;
    earned[code] = (earned[code] ?? 0) + item.score;
    available[code] = (available[code] ?? 0) + item.points;
  }

  const percentages: Record<string, number> = {};
  for (const code of Object.keys(available)) {
    const max = available[code] ?? 0;
    if (max > 0) {
      const pct = (100 * (earned[code] ?? 0)) / max;
      percentages[code] = Math.round(pct * 100) / 100;
    }
  }

  return percentages;
}
