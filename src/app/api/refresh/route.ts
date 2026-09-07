import { NextResponse } from "next/server";
import { refreshAll } from "@/lib/refresh";

export async function POST() {
  if (!process.env.FINNHUB_API_KEY) {
    return NextResponse.json(
      { error: "FINNHUB_API_KEY is not configured. Add it to .env.local and restart the server." },
      { status: 500 }
    );
  }
  try {
    await refreshAll();
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
