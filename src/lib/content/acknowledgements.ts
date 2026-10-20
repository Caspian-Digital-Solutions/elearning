/** Raw counts for acknowledgement pages: "N of M active people". */
export function formatAcknowledgementCount(confirmed: number, activeTotal: number): string {
  const safeConfirmed = Math.max(0, confirmed);
  const safeTotal = Math.max(0, activeTotal);
  return `${safeConfirmed} of ${safeTotal} active people`;
}

export function countAcknowledged(
  acknowledgements: readonly { user_id: string }[],
  activeUserIds: ReadonlySet<string>,
): number {
  const seen = new Set<string>();
  for (const row of acknowledgements) {
    if (activeUserIds.has(row.user_id)) {
      seen.add(row.user_id);
    }
  }
  return seen.size;
}
