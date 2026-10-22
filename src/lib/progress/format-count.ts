/** Raw completion counts for progress tables (never a percentage on its own). */
export function formatCount(done: number, total: number): string {
  if (total <= 0) {
    return done === 0 ? "0 of 0" : `${done} of 0`;
  }
  return `${done} of ${total}`;
}
