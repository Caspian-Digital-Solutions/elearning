import "server-only";

/** Logs server failures without leaking details to the client. */
export function logServerError(context: {
  route: string;
  userId?: string | null;
  digest?: string;
  error: unknown;
}): void {
  const message = context.error instanceof Error ? context.error.message : String(context.error);
  console.error("[server-error]", {
    route: context.route,
    userId: context.userId ?? null,
    digest: context.digest ?? null,
    message,
  });
}
