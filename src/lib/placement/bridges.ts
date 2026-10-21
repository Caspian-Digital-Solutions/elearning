import type { ModuleSortKey, PlacementBridgeModules } from "./types";

export function computeBridgeModules(
  suggestedStream: string,
  domainPercentages: Record<string, number>,
  bridgeModules: PlacementBridgeModules,
  bridgeThresholdPct: number,
  moduleOrder: ModuleSortKey[],
): string[] {
  if (suggestedStream !== "practitioner") {
    return [];
  }

  const collected: string[] = [];
  const seen = new Set<string>();

  const domainCodes = Object.keys(domainPercentages).sort();
  for (const domainCode of domainCodes) {
    const pct = domainPercentages[domainCode] ?? 0;
    if (pct >= bridgeThresholdPct) {
      continue;
    }
    const modules = bridgeModules.modules[domainCode] ?? [];
    for (const code of modules) {
      if (!seen.has(code)) {
        seen.add(code);
        collected.push(code);
      }
    }
  }

  if (collected.length === 0) {
    return [];
  }

  const orderIndex = new Map(
    moduleOrder.map((entry) => [
      entry.code,
      entry.stageSortOrder * 1000 + entry.moduleSortOrder,
    ]),
  );

  return [...collected].sort((left, right) => {
    const leftOrder = orderIndex.get(left) ?? Number.MAX_SAFE_INTEGER;
    const rightOrder = orderIndex.get(right) ?? Number.MAX_SAFE_INTEGER;
    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }
    return left.localeCompare(right);
  });
}
