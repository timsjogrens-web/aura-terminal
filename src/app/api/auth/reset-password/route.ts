import { NextRequest, NextResponse } from "next/server";
import { peekAuthToken, consumeAuthToken, setPassword, UserError } from "@/lib/users";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const token = typeof body?.token === "string" ? body.token : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!token || !password) {
    return NextResponse.json({ error: "Ogiltig begäran." }, { status: 400 });
  }

  const userId = await peekAuthToken(token, "reset");
  if (!userId) {
    return NextResponse.json({ error: "Länken är ogiltig eller har gått ut." }, { status: 400 });
  }

  try {
    await setPassword(userId, password);
    await consumeAuthToken(token);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof UserError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Kunde inte återställa lösenordet." }, { status: 500 });
  }
}
