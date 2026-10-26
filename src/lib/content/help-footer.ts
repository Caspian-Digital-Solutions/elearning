import { formatDate } from "@/lib/format";

/** Footer line for published help pages. */
export function helpPageUpdatedLabel(publishedAt: string | null | undefined): string {
  if (!publishedAt) {
    return "Not yet published";
  }
  const formatted = formatDate(publishedAt);
  return formatted ? `Updated ${formatted}` : "Not yet published";
}
