export type ProgressTab = "people" | "departments" | "modules" | "weekly" | "myPlan" | "timeTotals";

const tabLabels: Record<ProgressTab, string> = {
  people: "the people list",
  departments: "department summary",
  modules: "module summary",
  weekly: "weekly activity",
  myPlan: "your plan",
  timeTotals: "time log totals",
};

export type ProgressSectionResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string };

export function progressTabUserMessage(tab: ProgressTab): string {
  return `We could not load ${tabLabels[tab]} right now. Try refreshing this page, or use the other tabs.`;
}
