import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { getGoogleAuthUrl, GoogleOAuthError } from "@/lib/googleOAuth";

// Public (GET) — kicks off Google's consent screen. The random `state`
// is stashed in a short-lived cookie and checked back in the callback,
// standard CSRF protection for OAuth redirects (stops a forged callback
// link from logging a victim into an attacker-chosen account).
export async function GET(req: NextRequest) {
  const state = randomBytes(16).toString("hex");
  try {
    const url = getGoogleAuthUrl(req.nextUrl.origin, state);
    const res = NextResponse.redirect(url);
    res.cookies.set("google_oauth_state", state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 600,
      path: "/",
    });
    return res;
  } catch (e) {
    const message = e instanceof GoogleOAuthError ? e.message : "Google-inloggning är inte konfigurerad.";
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(message)}`, req.url));
  }
}
