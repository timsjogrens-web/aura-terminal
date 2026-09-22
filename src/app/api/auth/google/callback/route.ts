import { NextRequest, NextResponse } from "next/server";
import { getGoogleUserInfo, GoogleOAuthError } from "@/lib/googleOAuth";
import { findOrCreateGoogleUser } from "@/lib/users";
import { getSession } from "@/lib/session";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const cookieState = req.cookies.get("google_oauth_state")?.value;

  if (!code || !state || !cookieState || state !== cookieState) {
    return NextResponse.redirect(new URL("/login?error=Google-inloggningen misslyckades (ogiltig state).", req.url));
  }

  try {
    const googleUser = await getGoogleUserInfo(code, req.nextUrl.origin);
    const { user, isNew } = await findOrCreateGoogleUser(googleUser.email);

    const session = await getSession();
    session.userId = user.id;
    session.email = user.email;
    session.isAdmin = user.isAdmin;
    await session.save();

    const res = NextResponse.redirect(new URL(isNew ? "/paper?welcome=1" : "/paper", req.url));
    res.cookies.delete("google_oauth_state");
    return res;
  } catch (e) {
    const message = e instanceof GoogleOAuthError ? e.message : "Google-inloggningen misslyckades.";
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(message)}`, req.url));
  }
}
