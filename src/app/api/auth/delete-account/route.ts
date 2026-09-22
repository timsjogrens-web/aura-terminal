import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { deleteUser, UserError } from "@/lib/users";

export async function DELETE() {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    await deleteUser(session.userId);
    session.destroy();
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof UserError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Kunde inte radera kontot." }, { status: 500 });
  }
}
