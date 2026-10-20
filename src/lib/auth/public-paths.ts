/** Paths a signed-out visitor may open. Everything else redirects to /login. */
const publicPaths = ["/login", "/auth/callback"] as const;

export function isPublicPath(pathname: string): boolean {
  return publicPaths.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}
