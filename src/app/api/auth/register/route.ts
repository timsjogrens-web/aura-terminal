import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { createUser, createAuthToken, UserError } from "@/lib/users";
import { sendVerificationEmail } from "@/lib/email";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

const MAX_SIGNUPS = 8;
const WINDOW_MS = 60 * 60 * 1000;

// Public (see proxy.ts) — anyone can create their own account, which
// starts blank at $100,000 in both simulated portfolios (see
// portfolio.ts) with the auto-trading bot switched off until they choose
// to turn it on.
export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rate = await checkRateLimit(`register:${ip}`, MAX_SIGNUPS, WINDOW_MS);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "För många kontoregistreringar från din anslutning. Försök igen om en stund." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSec ?? 3600) } }
    );
  }

  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email : "";
  const password = typeof body?.password === "string" ? body.password : "";

  try {
    const user = await createUser(email, password);
    const session = await getSession();
    session.userId = user.id;
    session.email = user.email;
    session.isAdmin = user.isAdmin;
    await session.save();

    const token = await createAuthToken(user.id, "verify");
    const verifyUrl = `${req.nextUrl.origin}/api/auth/verify-email?token=${token}`;
    sendVerificationEmail(user.email, verifyUrl).catch(() => {});

    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof UserError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Kunde inte skapa kontot." }, { status: 500 });
  }
}
