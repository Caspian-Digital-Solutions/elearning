import { itemAppliesToLearner } from "./item-applies";
import type { PlacementScoredItem } from "./types";
import type { Week0Sections } from "@/lib/settings/validators";

export function computeSectionScores(
  week0Sections: Week0Sections,
  items: PlacementScoredItem[],
  departmentMatchId: string | null,
): Record<string, number> {
  const scores: Record<string, number> = {};

  for (const section of week0Sections.sections) {
    scores[section.code] = 0;
  }

  for (const item of items) {
    if (!itemAppliesToLearner(item, item.sectionCode, departmentMatchId)) {
      continue;
    }
    if (item.type === "profile") {
      continue;
    }
    const current = scores[item.sectionCode] ?? 0;
    scores[item.sectionCode] = current + item.score;
  }

  return scores;
}

export function computeTotal(
  week0Sections: Week0Sections,
  sectionScores: Record<string, number>,
): number {
  let total = 0;
  for (const section of week0Sections.sections) {
    if (section.counts_in_total) {
      total += sectionScores[section.code] ?? 0;
    }
  }
  return total;
}
