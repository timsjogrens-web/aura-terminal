import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getProfile, searchSymbol, FinnhubError } from "@/lib/finnhub";
import { refreshOne } from "@/lib/refresh";
import { UNIVERSE_MAP } from "@/lib/universe";

export async function GET() {
  const rows = db
    .prepare("SELECT ticker, company_name, sector, added_at FROM watchlist ORDER BY added_at DESC")
    .all();
  return NextResponse.json({ watchlist: rows });
}

export async function POST(req: NextRequest) {
  const { ticker: raw } = await req.json();
  if (typeof raw !== "string" || !raw.trim()) {
    return NextResponse.json({ error: "Ticker is required." }, { status: 400 });
  }
  const ticker = raw.trim().toUpperCase();

  const existing = db.prepare("SELECT ticker FROM watchlist WHERE ticker = ?").get(ticker);
  if (existing) {
    return NextResponse.json({ error: `${ticker} is already on your watchlist.` }, { status: 409 });
  }

  let name = UNIVERSE_MAP.get(ticker)?.name ?? ticker;
  let sector = UNIVERSE_MAP.get(ticker)?.sector ?? "Watchlist";

  if (!UNIVERSE_MAP.has(ticker)) {
    if (!process.env.FINNHUB_API_KEY) {
      return NextResponse.json(
        { error: "FINNHUB_API_KEY is not configured, so ticker symbols can't be validated." },
        { status: 500 }
      );
    }
    try {
      const search = await searchSymbol(ticker);
      const match = search.result.find(
        (r) => r.symbol.toUpperCase() === ticker && r.type === "Common Stock"
      );
      if (!match) {
        return NextResponse.json(
          { error: `"${ticker}" doesn't look like a valid US equity symbol.` },
          { status: 400 }
        );
      }
      const profile = await getProfile(ticker);
      name = profile.name ?? match.description ?? ticker;
      sector = profile.finnhubIndustry ?? "Watchlist";
    } catch (e) {
      const message = e instanceof FinnhubError ? e.message : "Could not validate ticker.";
      return NextResponse.json({ error: message }, { status: 502 });
    }
  }

  db.prepare(
    "INSERT INTO watchlist (ticker, company_name, sector, added_at) VALUES (?, ?, ?, ?)"
  ).run(ticker, name, sector, new Date().toISOString());

  refreshOne(ticker, name, sector).catch(() => {});

  return NextResponse.json({ ok: true, ticker, name, sector });
}

export async function DELETE(req: NextRequest) {
  const { ticker } = await req.json();
  if (typeof ticker !== "string") {
    return NextResponse.json({ error: "Ticker is required." }, { status: 400 });
  }
  db.prepare("DELETE FROM watchlist WHERE ticker = ?").run(ticker.toUpperCase());
  return NextResponse.json({ ok: true });
}
