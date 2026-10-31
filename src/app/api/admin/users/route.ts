import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { listAllUsers } from "@/lib/users";

// Admin-only — the whole point is seeing every account, so this is
// exactly the kind of endpoint that must never be reachable without the
// admin flag, unlike most per-account endpoints in this app.
export async function GET() {
  const session = await getSession();
  if (!session.isAdmin) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const users = await listAllUsers();
  return NextResponse.json({ users });
}
