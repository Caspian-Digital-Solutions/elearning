import "server-only";

import {
  type ProgressSectionResult,
  type ProgressTab,
  progressTabUserMessage,
} from "@/lib/progress/load-section-messages";

export type { ProgressSectionResult, ProgressTab } from "@/lib/progress/load-section-messages";

export function logProgressQueryFailure(
  tab: ProgressTab,
  error: { code?: string; message?: string; details?: string; hint?: string },
): void {
  console.error(`[progress] ${tab} query failed`, {
    code: error.code,
    message: error.message,
    details: error.details,
    hint: error.hint,
  });
}

export function logProgressLoadFailure(tab: ProgressTab, error: unknown): void {
  console.error(`[progress] ${tab} load failed`, error);
}

/** Runs one progress tab loader without failing the whole page. */
export async function loadProgressSection<T>(
  tab: ProgressTab,
  load: () => Promise<T>,
): Promise<ProgressSectionResult<T>> {
  try {
    const data = await load();
    return { ok: true, data };
  } catch (error) {
    logProgressLoadFailure(tab, error);
    return { ok: false, message: progressTabUserMessage(tab) };
  }
}
