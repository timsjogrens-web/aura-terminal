import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions, SessionData } from "@/lib/session";

// /api/refresh handles its own auth (session OR cron secret) since Vercel
// Cron calls it without a session cookie.
const PUBLIC_PATHS = ["/login", "/api/auth/login", "/api/auth/logout", "/api/auth/session", "/api/refresh"];
// Shareable signal cards are meant to be opened by people who don't have
// an account — the whole point is a link that works when someone else
// clicks it, so these two stay outside the login gate.
const PUBLIC_PREFIXES = ["/share/", "/api/share/"];

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (
    PUBLIC_PATHS.includes(pathname) ||
    PUBLIC_PREFIXES.some((p) => pathname.startsWith(p)) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon")
  ) {
    return NextResponse.next();
  }

  // The site is open to view without logging in — anyone can browse every
  // page and read-only API route. Only requests that CHANGE something
  // (placing a trade, editing the watchlist, forcing a refresh of insider/
  // investor data) still require Tim's own login — there's one shared
  // paper account and one shared watchlist behind this, not a per-visitor
  // one, so a stranger being able to write to them would corrupt the very
  // track record this site's honesty is built on.
  if (req.method === "GET" || req.method === "HEAD") {
    return NextResponse.next();
  }

  const res = NextResponse.next();
  const session = await getIronSession<SessionData>(req, res, sessionOptions);

  if (!session.loggedIn) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
