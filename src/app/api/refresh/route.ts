import { NextRequest, NextResponse } from "next/server";
import { refreshAll } from "@/lib/refresh";
import { getSession } from "@/lib/session";

// One call refreshes a batch of the stalest stocks within this window.
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  // Called two ways: the authenticated "Refresh now" button (session cookie),
  // and the hosting platform's scheduled cron hitting this route directly
  // (no cookie, so it authenticates with a shared secret instead).
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  const isCron = Boolean(cronSecret) && authHeader === `Bearer ${cronSecret}`;

  if (!isCron) {
    const session = await getSession();
    if (!session.isAdmin) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
  }

  if (!process.env.FINNHUB_API_KEY) {
    return NextResponse.json(
      { error: "FINNHUB_API_KEY is not configured. Add it to .env.local and restart the server." },
      { status: 500 }
    );
  }
  try {
    const result = await refreshAll();
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
