import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getUserById } from "@/lib/users";

// Public (see proxy.ts) — lets the UI tell an anonymous visitor apart from
// a logged-in user (any user now, not just Tim), and tell an ordinary
// user apart from the site's admin (Tim) for the handful of actions still
// restricted to him: forcing a global data refresh, checking for new
// 13F/insider filings, and editing the shared watchlist.
export async function GET() {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ loggedIn: false, isAdmin: false, email: null, emailVerified: false });
  }

  // Looked up fresh rather than trusted from the session cookie —
  // emailVerified can flip true in a different tab/request (clicking the
  // verification link) without this session ever re-logging in.
  const user = await getUserById(session.userId);
  return NextResponse.json({
    loggedIn: true,
    isAdmin: session.isAdmin === true,
    email: session.email ?? null,
    emailVerified: user?.emailVerified ?? false,
  });
}
