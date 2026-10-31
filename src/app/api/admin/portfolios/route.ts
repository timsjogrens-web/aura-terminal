import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { listAllUsers } from "@/lib/users";
import { getPortfolioState, STARTING_CASH } from "@/lib/portfolio";

interface Summary {
  startedAt: string | null;
  totalValue: number;
  totalReturnPct: number;
  openPositions: number;
}

// Admin-only, same gate as /api/admin/users — reuses the exact same
// per-user accounting (getPortfolioState) the owner's own /paper and
// /self-trade pages use, just run for every account instead of the
// logged-in one, so "every user's return %" can never drift from what
// each user sees on their own account.
export async function GET() {
  const session = await getSession();
  if (!session.isAdmin) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const users = await listAllUsers();

  const perUserStates = await Promise.all(
    users.map(async (u) => ({
      userId: u.id,
      auto: await getPortfolioState("auto", u.id),
      manual: await getPortfolioState("manual", u.id),
    }))
  );

  const allTickers = new Set<string>();
  for (const s of perUserStates) {
    for (const p of s.auto.openPositions) allTickers.add(p.ticker);
    for (const p of s.manual.openPositions) allTickers.add(p.ticker);
  }

  let priceByTicker = new Map<string, number>();
  if (allTickers.size > 0) {
    const tickers = [...allTickers];
    const placeholders = tickers.map(() => "?").join(",");
    const res = await db.execute({
      sql: `SELECT ticker, price FROM quote_cache WHERE ticker IN (${placeholders})`,
      args: tickers,
    });
    const rows = res.rows as unknown as { ticker: string; price: number | null }[];
    priceByTicker = new Map(rows.map((r) => [r.ticker, Number(r.price ?? 0)]));
  }

  function summarize(state: Awaited<ReturnType<typeof getPortfolioState>>): Summary {
    const holdingsValue = state.openPositions.reduce((a, p) => {
      const price = priceByTicker.get(p.ticker) ?? p.entryPrice;
      return a + p.shares * price;
    }, 0);
    const totalValue = state.cash + holdingsValue;
    return {
      startedAt: state.startedAt,
      totalValue,
      totalReturnPct: ((totalValue - STARTING_CASH) / STARTING_CASH) * 100,
      openPositions: state.openPositions.length,
    };
  }

  const portfolios = perUserStates.map((s) => ({
    userId: s.userId,
    paper: summarize(s.auto),
    selfTrade: summarize(s.manual),
  }));

  return NextResponse.json({ portfolios });
}
