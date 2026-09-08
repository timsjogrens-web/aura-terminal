import { NextRequest, NextResponse } from "next/server";
import { getProfile, FinnhubError } from "@/lib/finnhub";

export async function GET(req: NextRequest) {
  const ticker = req.nextUrl.searchParams.get("ticker");
  if (!ticker) {
    return NextResponse.json({ error: "Ticker is required." }, { status: 400 });
  }
  try {
    const profile = await getProfile(ticker.toUpperCase());
    return NextResponse.json({ profile });
  } catch (e) {
    const message = e instanceof FinnhubError ? e.message : "Failed to load company info.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
