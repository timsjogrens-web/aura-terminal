import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";

// Public (see proxy.ts) — lets the UI tell an anonymous visitor apart from
// Tim's own logged-in session, e.g. to show "Log in" instead of "Log out",
// or to hide/disable controls that only he can actually use (trading,
// editing the watchlist, forcing a refresh).
export async function GET() {
  const session = await getSession();
  return NextResponse.json({ loggedIn: session.loggedIn === true });
}
