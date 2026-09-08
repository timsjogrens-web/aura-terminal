import { NextRequest, NextResponse, after } from "next/server";
import { db } from "@/lib/db";
import { getProfile, searchSymbol, FinnhubError } from "@/lib/finnhub";
import { refreshOne } from "@/lib/refresh";
import { UNIVERSE_MAP } from "@/lib/universe";

export async function GET() {
  const res = await db.execute(
    "SELECT ticker, company_name, sector, added_at FROM watchlist ORDER BY added_at DESC"
  );
  return NextResponse.json({ watchlist: res.rows });
}

export async function POST(req: NextRequest) {
  const { ticker: raw } = await req.json();
  if (typeof raw !== "string" || !raw.trim()) {
    return NextResponse.json({ error: "Ticker is required." }, { status: 400 });
  }
  const ticker = raw.trim().toUpperCase();

  const existingRes = await db.execute({
    sql: "SELECT ticker FROM watchlist WHERE ticker = ?",
    args: [ticker],
  });
  if (existingRes.rows.length > 0) {
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

  await db.execute({
    sql: "INSERT INTO watchlist (ticker, company_name, sector, added_at) VALUES (?, ?, ?, ?)",
    args: [ticker, name, sector, new Date().toISOString()],
  });

  after(() => refreshOne(ticker, name, sector).catch(() => {}));

  return NextResponse.json({ ok: true, ticker, name, sector });
}

export async function DELETE(req: NextRequest) {
  const { ticker } = await req.json();
  if (typeof ticker !== "string") {
    return NextResponse.json({ error: "Ticker is required." }, { status: 400 });
  }
  await db.execute({
    sql: "DELETE FROM watchlist WHERE ticker = ?",
    args: [ticker.toUpperCase()],
  });
  return NextResponse.json({ ok: true });
}
