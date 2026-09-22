import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions, SessionData } from "@/lib/session";

// /api/refresh handles its own auth (session OR cron secret) since Vercel
// Cron calls it without a session cookie.
const PUBLIC_PATHS = [
  "/login",
  "/signup",
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/logout",
  "/api/auth/session",
  "/api/refresh",
];
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
  // page and read-only API route. Any request that CHANGES something needs
  // an account — each user gets their own paper-trading bot and their own
  // self-trade account, isolated from everyone else's, so this only checks
  // that SOMEONE is logged in. A handful of actions are further restricted
  // to Tim specifically (the shared watchlist, forcing a global data
  // refresh, checking for new 13F/insider filings) — those routes check
  // session.isAdmin themselves, since this gate can't tell accounts apart.
  if (req.method === "GET" || req.method === "HEAD") {
    return NextResponse.next();
  }

  const res = NextResponse.next();
  const session = await getIronSession<SessionData>(req, res, sessionOptions);

  if (!session.userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
