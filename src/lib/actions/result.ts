export type ActionResult<T = null> = { ok: true; data: T } | { ok: false; error: string };

export const notAllowed = "You do not have permission to do that. Sign in again, or ask an admin.";

type DatabaseError = { code?: string; message: string } | null | undefined;

/**
 * Our database functions raise plain-English messages with codes 22023 (bad
 * input) and 42501 (not allowed). Anything else, including Postgres's own
 * row-level security messages, is replaced with the fallback.
 */
export function databaseMessage(error: DatabaseError, fallback: string): string {
  if (!error) {
    return fallback;
  }
  const ours =
    (error.code === "22023" || error.code === "42501") &&
    !/row-level security|permission denied|violates/i.test(error.message);
  return ours ? error.message : fallback;
}
