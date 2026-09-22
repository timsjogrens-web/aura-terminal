import { NextRequest, NextResponse } from "next/server";
import { peekAuthToken, consumeAuthToken, setEmailVerified } from "@/lib/users";

// Public (GET, see proxy.ts) — this IS the click target of the emailed
// link, so it can't require a session of its own.
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.redirect(new URL("/paper?verify=missing", req.url));
  }

  const userId = await peekAuthToken(token, "verify");
  if (!userId) {
    return NextResponse.redirect(new URL("/paper?verify=invalid", req.url));
  }

  await setEmailVerified(userId);
  await consumeAuthToken(token);
  return NextResponse.redirect(new URL("/paper?verify=ok", req.url));
}
