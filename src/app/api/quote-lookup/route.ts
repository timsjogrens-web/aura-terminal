import { NextRequest, NextResponse } from "next/server";
import { getQuote, getProfile, FinnhubError } from "@/lib/finnhub";

// A live single-ticker lookup for the self-trade order ticket — unlike
// /api/quotes (the cached 30-stock universe, refreshed on a cycle), this
// hits Finnhub directly so a ticker outside the tracked universe still
// gets a real, current price to trade against.
export async function GET(req: NextRequest) {
  const ticker = req.nextUrl.searchParams.get("ticker");
  if (!ticker) {
    return NextResponse.json({ error: "Ticker is required." }, { status: 400 });
  }
  const symbol = ticker.toUpperCase();

  try {
    const [quote, profile] = await Promise.all([
      getQuote(symbol),
      getProfile(symbol).catch(() => null),
    ]);
    return NextResponse.json({
      ticker: symbol,
      price: quote.c,
      change: quote.d,
      changePct: quote.dp,
      name: profile?.name ?? null,
      logo: profile?.logo ?? null,
    });
  } catch (e) {
    const message = e instanceof FinnhubError ? e.message : "Could not fetch a live price for this ticker.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
