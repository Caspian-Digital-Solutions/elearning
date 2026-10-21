import type { Stream } from "@/lib/people/labels";
import type { PlacementBands } from "@/lib/settings/validators";

export type BandMatch = {
  suggestedBand: string;
  suggestedStream: Stream;
  bridgeThresholdPct: number;
};

const DEFAULT_BRIDGE_THRESHOLD = 60;

export function matchBand(total: number, bands: PlacementBands): BandMatch | null {
  const ordered = [...bands.bands].sort((left, right) => left.min - right.min);
  for (const band of ordered) {
    if (total >= band.min && total <= band.max) {
      const extra = band as { bridges_for_domains_below_pct?: number };
      const bridgeThresholdPct =
        typeof extra.bridges_for_domains_below_pct === "number"
          ? extra.bridges_for_domains_below_pct
          : DEFAULT_BRIDGE_THRESHOLD;
      return {
        suggestedBand: band.stream,
        suggestedStream: band.stream,
        bridgeThresholdPct,
      };
    }
  }
  return null;
}

export function bridgeThresholdForPlacement(
  total: number,
  bands: PlacementBands,
  gatesFailed: string[],
): number {
  if (gatesFailed.length > 0) {
    return DEFAULT_BRIDGE_THRESHOLD;
  }
  const match = matchBand(total, bands);
  return match?.bridgeThresholdPct ?? DEFAULT_BRIDGE_THRESHOLD;
}
