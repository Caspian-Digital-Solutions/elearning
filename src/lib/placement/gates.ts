import type { PlacementGates } from "@/lib/settings/validators";

export function evaluateGates(
  gates: PlacementGates,
  sectionScores: Record<string, number>,
): string[] {
  const failed: string[] = [];
  const safety = sectionScores.safety ?? 0;
  const prompting = sectionScores.prompting ?? 0;

  if (safety < gates.safety_min_else_foundation) {
    failed.push("safety");
  }
  if (prompting < gates.prompting_min_for_practitioner) {
    failed.push("prompting");
  }

  return failed;
}
