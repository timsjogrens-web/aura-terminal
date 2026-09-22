import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { verifyCredentials } from "@/lib/users";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

const MAX_ATTEMPTS = 15;
const WINDOW_MS = 15 * 60 * 1000;

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rate = await checkRateLimit(`login:${ip}`, MAX_ATTEMPTS, WINDOW_MS);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "För många inloggningsförsök. Försök igen om en stund." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSec ?? 900) } }
    );
  }

  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!email || !password) {
    return NextResponse.json({ error: "E-post och lösenord krävs." }, { status: 400 });
  }

  const user = await verifyCredentials(email, password);
  if (!user) {
    return NextResponse.json({ error: "Fel e-post eller lösenord." }, { status: 401 });
  }

  const session = await getSession();
  session.userId = user.id;
  session.email = user.email;
  session.isAdmin = user.isAdmin;
  await session.save();

  return NextResponse.json({ ok: true });
}
