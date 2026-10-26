import { isProductionAppEnv, readAppEnv } from "@/lib/app-env";

/** Visible on every page when this deployment is not production. */
export function DevelopmentRibbon() {
  if (isProductionAppEnv()) {
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
