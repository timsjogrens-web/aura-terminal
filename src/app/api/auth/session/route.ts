import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";

// Public (see proxy.ts) — lets the UI tell an anonymous visitor apart from
// a logged-in user (any user now, not just Tim), and tell an ordinary
// user apart from the site's admin (Tim) for the handful of actions still
// restricted to him: forcing a global data refresh, checking for new
// 13F/insider filings, and editing the shared watchlist.
export async function GET() {
  const session = await getSession();
  return NextResponse.json({
    loggedIn: Boolean(session.userId),
    isAdmin: session.isAdmin === true,
    email: session.email ?? null,
  });
}
