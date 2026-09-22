import { NextRequest, NextResponse } from "next/server";
import { getUserByEmail, createAuthToken } from "@/lib/users";
import { sendPasswordResetEmail } from "@/lib/email";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

// Always returns the same generic success response whether or not the
// email actually has an account — the point of a "forgot password" form
// is that it can't be used to check which emails have signed up.
export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rate = await checkRateLimit(`forgot-password:${ip}`, 6, 15 * 60 * 1000);
  if (!rate.allowed) {
    return NextResponse.json({ ok: true }); // same generic response even when throttled
  }

  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email : "";

  if (email) {
    const user = await getUserByEmail(email);
    if (user) {
      const token = await createAuthToken(user.id, "reset");
      const resetUrl = `${req.nextUrl.origin}/reset-password?token=${token}`;
      sendPasswordResetEmail(user.email, resetUrl).catch(() => {});
    }
  }

  return NextResponse.json({ ok: true });
}
