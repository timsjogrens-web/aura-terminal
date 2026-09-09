import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getManualPortfolioState, executeManualTrade, ManualTradeError, STARTING_CASH } from "@/lib/manualTrading";
import { getQuote, FinnhubError } from "@/lib/finnhub";
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

export async function GET() {
  const state = await getManualPortfolioState();

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
      };
    })
  );

  const holdingsValue = positions.reduce((a, p) => a + p.value, 0);
  const totalValue = state.cash + holdingsValue;
  const totalReturnPct = ((totalValue - STARTING_CASH) / STARTING_CASH) * 100;

  return NextResponse.json({
    startingCash: STARTING_CASH,
    cash: state.cash,
    totalValue,
    totalReturnPct,
    startedAt: state.startedAt,
    positions,
    trades: state.trades,
  });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session.loggedIn) {
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
    await executeManualTrade(ticker, action, shares, price);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof ManualTradeError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    const message = e instanceof FinnhubError ? e.message : "Trade failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
