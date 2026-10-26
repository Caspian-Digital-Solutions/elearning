import { isProductionAppEnv, readAppEnv } from "@/lib/app-env";
import { isPreLaunchDatabase } from "@/lib/system/pre-launch";

/** Visible on preview and local builds (not production pre-launch or cut-over production). */
export function DevelopmentRibbon() {
  if (isProductionAppEnv() || isPreLaunchDatabase()) {
    return null;
  }
  const env = readAppEnv();
  const label = env === "preview" ? "PREVIEW" : "DEVELOPMENT";
  return (
    <div
      className="shrink-0 border-b border-amber-700/40 bg-amber-500 px-3 py-1.5 text-center text-sm font-medium text-amber-950"
      role="status"
    >
      {label} — not production data
    </div>
  );
}
