import { NextRequest, NextResponse, after } from "next/server";
import { db } from "@/lib/db";
import { getProfile, searchSymbol, FinnhubError } from "@/lib/finnhub";
import { refreshOne } from "@/lib/refresh";
import { UNIVERSE_MAP } from "@/lib/universe";
import { getSession } from "@/lib/session";

// Personal per-account watchlist — GET requires a session (there's no
// meaningful "shared" list to show an anonymous visitor anymore), and
// write access is just "you're logged in", same as paper/self-trade.
export async function GET() {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const res = await db.execute({
    sql: "SELECT ticker, company_name, sector, added_at FROM watchlist WHERE user_id = ? ORDER BY added_at DESC",
    args: [session.userId],
  });
  return NextResponse.json({ watchlist: res.rows });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { ticker: raw } = await req.json();
  if (typeof raw !== "string" || !raw.trim()) {
    return NextResponse.json({ error: "Ticker is required." }, { status: 400 });
  }
  const ticker = raw.trim().toUpperCase();

  const existingRes = await db.execute({
    sql: "SELECT ticker FROM watchlist WHERE user_id = ? AND ticker = ?",
    args: [session.userId, ticker],
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
    sql: "INSERT INTO watchlist (user_id, ticker, company_name, sector, added_at) VALUES (?, ?, ?, ?, ?)",
    args: [session.userId, ticker, name, sector, new Date().toISOString()],
  });

  // Refreshing this ticker's quote data is universe-wide (whoever else is
  // watching it benefits too), not specific to this one user's watchlist.
  after(() => refreshOne(ticker, name, sector).catch(() => {}));

  return NextResponse.json({ ok: true, ticker, name, sector });
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { ticker } = await req.json();
  if (typeof ticker !== "string") {
    return NextResponse.json({ error: "Ticker is required." }, { status: 400 });
  }
  await db.execute({
    sql: "DELETE FROM watchlist WHERE user_id = ? AND ticker = ?",
    args: [session.userId, ticker.toUpperCase()],
  });
  return NextResponse.json({ ok: true });
}
