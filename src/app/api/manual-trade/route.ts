import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getManualPortfolioState, executeManualTrade, ManualTradeError, STARTING_CASH } from "@/lib/manualTrading";
import { getQuote, getProfile, FinnhubError } from "@/lib/finnhub";
import { getSession } from "@/lib/session";

async function resolvePrice(ticker: string): Promise<number | null> {
  const cached = await db.execute({ sql: "SELECT price FROM quote_cache WHERE ticker = ?", args: [ticker] });
  const cachedPrice = (cached.rows[0] as { price: number | null } | undefined)?.price ?? null;
  if (cachedPrice) return cachedPrice;
  try {
    const q = await getQuote(ticker);
    return q.c || null;
  } catch {
    return null;
  }
}

// Self-trade allows any ticker, not just the tracked universe, so the
// quote_cache (only populated for that universe) won't always have a
// logo — falls back to a live Finnhub profile lookup for anything it
// hasn't already cached, same fallback shape as resolvePrice above.
async function resolveLogos(tickers: string[]): Promise<Map<string, string | null>> {
  const result = new Map<string, string | null>();
  if (tickers.length === 0) return result;

  const placeholders = tickers.map(() => "?").join(",");
  const cached = await db.execute({
    sql: `SELECT ticker, logo FROM quote_cache WHERE ticker IN (${placeholders})`,
    args: tickers,
  });
  for (const row of cached.rows as unknown as { ticker: string; logo: string | null }[]) {
    result.set(row.ticker, row.logo);
  }

  const missing = tickers.filter((t) => !result.has(t));
  await Promise.all(
    missing.map(async (t) => {
      try {
        const profile = await getProfile(t);
        result.set(t, profile.logo || null);
      } catch {
        result.set(t, null);
      }
    })
  );

  return result;
}

// Every account has its own self-trade portfolio now, so this requires a
// session — there's no single shared demo account left to show an
// anonymous visitor.
export async function GET() {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const state = await getManualPortfolioState(session.userId);

  const tickers = Array.from(
    new Set([...state.openPositions.map((p) => p.ticker), ...state.trades.map((t) => t.ticker)])
  );
  const logoByTicker = await resolveLogos(tickers);

  const positions = await Promise.all(
    state.openPositions.map(async (p) => {
      const currentPrice = (await resolvePrice(p.ticker)) ?? p.entryPrice;
      const value = p.shares * currentPrice;
      const costBasis = p.shares * p.entryPrice;
      return {
        ...p,
        currentPrice,
        value,
        returnPct: costBasis > 0 ? ((value - costBasis) / costBasis) * 100 : 0,
        logo: logoByTicker.get(p.ticker) ?? null,
      };
    })
  );

  const trades = state.trades.map((t) => ({ ...t, logo: logoByTicker.get(t.ticker) ?? null }));

  const holdingsValue = positions.reduce((a, p) => a + p.value, 0);
  const totalValue = state.cash + holdingsValue;
  const totalReturnPct = ((totalValue - STARTING_CASH) / STARTING_CASH) * 100;
  const unrealizedPnl = positions.reduce((a, p) => a + (p.value - p.shares * p.entryPrice), 0);

  return NextResponse.json({
    startingCash: STARTING_CASH,
    cash: state.cash,
    totalValue,
    totalReturnPct,
    unrealizedPnl,
    realizedPnl: state.realizedPnl,
    startedAt: state.startedAt,
    positions,
    trades,
  });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const ticker = (body?.ticker ?? "").toString().toUpperCase().trim();
  const action = body?.action;
  const shares = Number(body?.shares);

  if (!ticker) {
    return NextResponse.json({ error: "Missing ticker." }, { status: 400 });
  }
  if (action !== "BUY" && action !== "SELL") {
    return NextResponse.json({ error: "Action must be BUY or SELL." }, { status: 400 });
  }

  try {
    const price = await getQuote(ticker).then((q) => q.c);
    if (!price) {
      return NextResponse.json({ error: `No live price available for ${ticker}.` }, { status: 502 });
    }
    await executeManualTrade(session.userId, ticker, action, shares, price);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof ManualTradeError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    const message = e instanceof FinnhubError ? e.message : "Trade failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
