import type { PlacementScoredItem } from "./types";

/**
 * Whether an item counts for this learner. Mirrors `attempt_item_applies`.
 */
export function itemAppliesToLearner(
  item: PlacementScoredItem,
  sectionCode: string,
  departmentMatchId: string | null,
): boolean {
  if (item.type === "profile") {
    return true;
  }
  if (sectionCode === "department") {
    return item.departmentId != null && item.departmentId === departmentMatchId;
  }
  return item.departmentId == null;
}
