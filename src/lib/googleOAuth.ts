// Hand-rolled Google OAuth 2.0 "Authorization Code" flow — same philosophy
// as the rest of this project's data clients (finnhub.ts, turso.ts): plain
// fetch calls against Google's documented endpoints instead of adding
// next-auth or google-auth-library as a dependency for what's really just
// three HTTP calls.

export class GoogleOAuthError extends Error {}

function getCredentials(): { clientId: string; clientSecret: string } {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new GoogleOAuthError("Google-inloggning är inte konfigurerad ännu.");
  }
  return { clientId, clientSecret };
}

// `origin` is the exact scheme+host the request came in on (e.g.
// "https://candorapp.se" or "http://localhost:3000") — the
// redirect_uri built from it must byte-for-byte match one of the
// "Authorized redirect URIs" registered in Google Cloud Console, or
// Google rejects the request.
export function getGoogleAuthUrl(origin: string, state: string): string {
  const { clientId } = getCredentials();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${origin}/api/auth/google/callback`,
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

interface GoogleUserInfo {
  email: string;
  email_verified: boolean;
  name?: string;
}

export async function getGoogleUserInfo(code: string, origin: string): Promise<GoogleUserInfo> {
  const { clientId, clientSecret } = getCredentials();

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: `${origin}/api/auth/google/callback`,
      grant_type: "authorization_code",
    }),
  });
  if (!tokenRes.ok) {
    console.error("Google token exchange failed:", tokenRes.status, await tokenRes.text());
    throw new GoogleOAuthError("Kunde inte logga in med Google just nu.");
  }
  const tokenJson = (await tokenRes.json()) as { access_token: string };

  // Calling Google's own userinfo endpoint with the access token, rather
  // than decoding the id_token JWT ourselves, sidesteps needing to verify
  // its signature against Google's rotating public keys — Google has
  // already done that check before handing back this response.
  const userRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${tokenJson.access_token}` },
  });
  if (!userRes.ok) {
    console.error("Google userinfo request failed:", userRes.status);
    throw new GoogleOAuthError("Kunde inte logga in med Google just nu.");
  }
  const user = (await userRes.json()) as GoogleUserInfo;
  if (!user.email || !user.email_verified) {
    throw new GoogleOAuthError("Ditt Google-konto har ingen verifierad e-postadress.");
  }
  return user;
}
