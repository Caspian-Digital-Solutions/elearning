import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { readPublicEnv } from "@/lib/env-public";
import { isPublicPath } from "@/lib/auth/public-paths";

/**
 * Runs before every page: refreshes the Supabase session cookie and sends
 * signed-out visitors to /login. This is the first lock only; layouts,
 * server actions and row-level security check again.
 */
export async function proxy(request: NextRequest) {
  const env = readPublicEnv();
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
          Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
        },
      },
    },
  );

  // Do not run other code between creating the client and getClaims(): it refreshes the session.
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);
  const { pathname, searchParams } = request.nextUrl;

  if (!signedIn && !isPublicPath(pathname)) {
    return redirectKeepingCookies(request, response, "/login");
  }

  if (signedIn && pathname === "/login" && !searchParams.has("error")) {
    return redirectKeepingCookies(request, response, "/my-path");
  }

  return response;
}

function redirectKeepingCookies(request: NextRequest, response: NextResponse, pathname: string) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";
  const redirect = NextResponse.redirect(url);
  response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  // Responses that refresh auth cookies must not be cached (set by @supabase/ssr).
  for (const header of ["cache-control", "expires", "pragma"]) {
    const value = response.headers.get(header);
    if (value) redirect.headers.set(header, value);
  }
  return redirect;
}

export const config = {
  matcher: [
    // Every path except Next.js internals and files with an extension (logo, favicon, images).
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.[a-zA-Z0-9]+$).*)",
  ],
};
