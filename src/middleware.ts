import { NextResponse, type NextRequest } from "next/server";

/**
 * Edge middleware: a fast first line of defense for the /app area. It only
 * checks for the presence of the session cookie and redirects to /login if it
 * is missing. AUTHORITATIVE authorization (valid session, active account,
 * permissions) is always enforced server-side in the /app layout and in every
 * server action / route handler — middleware is never the sole gate.
 */
const SESSION_COOKIE = "perseus_session";

export function middleware(req: NextRequest) {
  const hasCookie = req.cookies.has(SESSION_COOKIE);
  if (!hasCookie) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/app/:path*"],
};
