import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { createUser, UserError } from "@/lib/users";

// Public (see proxy.ts) — anyone can create their own account, which
// starts blank at $100,000 in both simulated portfolios (see
// portfolio.ts) with the auto-trading bot switched off until they choose
// to turn it on.
export async function POST(req: NextRequest) {
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
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof UserError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Kunde inte skapa kontot." }, { status: 500 });
  }
}
