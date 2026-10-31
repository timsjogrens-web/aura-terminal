import { NextResponse } from "next/server";
import { getWeeklyTopPicks } from "@/lib/weeklyPicks";

// Public — same visibility as the rest of the market data (see proxy.ts).
export async function GET() {
  try {
    const picks = await getWeeklyTopPicks();
    return NextResponse.json({ picks });
  } catch (e) {
    console.error("[candor] weekly-picks failed:", e);
    return NextResponse.json({ error: "Kunde inte hämta veckans signaler." }, { status: 500 });
  }
}
