import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getUserById, createAuthToken } from "@/lib/users";
import { sendVerificationEmail } from "@/lib/email";
import { checkRateLimit } from "@/lib/rateLimit";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const rate = await checkRateLimit(`resend-verify:${session.userId}`, 3, 15 * 60 * 1000);
  if (!rate.allowed) {
    return NextResponse.json({ error: "Vänta lite innan du begär ett nytt mejl." }, { status: 429 });
  }

  const user = await getUserById(session.userId);
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (user.emailVerified) {
    return NextResponse.json({ ok: true, alreadyVerified: true });
  }

  const token = await createAuthToken(user.id, "verify");
  const verifyUrl = `${req.nextUrl.origin}/api/auth/verify-email?token=${token}`;
  await sendVerificationEmail(user.email, verifyUrl);

  return NextResponse.json({ ok: true });
}
