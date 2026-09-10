import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  getPaperPortfolioState,
  getPeakPrice,
  STARTING_CASH,
  STOP_LOSS_PCT,
  TRAILING_ARM_PCT,
  TRAILING_STOP_PCT,
} from "@/lib/paperTrading";
import { getChartSeries } from "@/lib/yahoo";

function pickRange(startedAt: string): string {
  const days = (Date.now() - new Date(startedAt).getTime()) / 86_400_000;
  if (days <= 5) return "1W";
  if (days <= 25) return "1M";
  if (days <= 80) return "3M";
  if (days <= 170) return "6M";
  if (days <= 350) return "1Y";
  if (days <= 1000) return "3Y";
  return "5Y";
}

// The S&P 500 comparison isn't a generic "market return" — it's what the
// exact same starting cash would be worth today if it had bought SPY
// instead of following the signals, over the exact same window this paper
// portfolio has been running. No comparison is shown until there's an
// actual first trade to anchor the window to.
async function getSpyComparison(startedAt: string) {
  const range = pickRange(startedAt);
  const series = await getChartSeries("SPY", range);
  const startMs = new Date(startedAt).getTime();
  let entryIdx = 0;
  for (let i = 0; i < series.timestamps.length; i++) {
    if (series.timestamps[i] * 1000 >= startMs) {
      entryIdx = i;
      break;
    }
    entryIdx = i;
  }
  const entryPrice = series.closes[entryIdx];
  const currentPrice = series.closes[series.closes.length - 1];
  const returnPct = ((currentPrice - entryPrice) / entryPrice) * 100;
  return { returnPct, entryPrice, currentPrice };
}

export async function GET() {
  const state = await getPaperPortfolioState();

  const tickers = Array.from(
    new Set([...state.openPositions.map((p) => p.ticker), ...state.trades.map((t) => t.ticker)])
  );
  let priceByTicker = new Map<string, number>();
  let logoByTicker = new Map<string, string | null>();
  if (tickers.length > 0) {
    const placeholders = tickers.map(() => "?").join(",");
    const res = await db.execute({
      sql: `SELECT ticker, price, logo FROM quote_cache WHERE ticker IN (${placeholders})`,
      args: tickers,
    });
    const rows = res.rows as unknown as { ticker: string; price: number | null; logo: string | null }[];
    priceByTicker = new Map(rows.map((r) => [r.ticker, Number(r.price ?? 0)]));
    logoByTicker = new Map(rows.map((r) => [r.ticker, r.logo]));
  }

  const positions = await Promise.all(
    state.openPositions.map(async (p) => {
      const currentPrice = priceByTicker.get(p.ticker) ?? p.entryPrice;
      const value = p.shares * currentPrice;
      const costBasis = p.shares * p.entryPrice;

      const stopLossPrice = p.entryPrice * (1 - STOP_LOSS_PCT / 100);
      const peak = (await getPeakPrice(p.ticker)) ?? p.entryPrice;
      const gainFromEntry = ((peak - p.entryPrice) / p.entryPrice) * 100;
      const trailingArmed = gainFromEntry >= TRAILING_ARM_PCT;
      const trailingStopPrice = trailingArmed ? peak * (1 - TRAILING_STOP_PCT / 100) : null;

      return {
        ...p,
        currentPrice,
        value,
        returnPct: costBasis > 0 ? ((value - costBasis) / costBasis) * 100 : 0,
        stopLossPrice,
        trailingArmed,
        trailingStopPrice,
        peakPrice: peak,
        logo: logoByTicker.get(p.ticker) ?? null,
      };
    })
  );

  const trades = state.trades.map((t) => ({ ...t, logo: logoByTicker.get(t.ticker) ?? null }));

  const holdingsValue = positions.reduce((a, p) => a + p.value, 0);
  const totalValue = state.cash + holdingsValue;
  const totalReturnPct = ((totalValue - STARTING_CASH) / STARTING_CASH) * 100;

  let spyComparison: { returnPct: number } | null = null;
  if (state.startedAt) {
    try {
      spyComparison = await getSpyComparison(state.startedAt);
    } catch {
      spyComparison = null; // S&P comparison omitted rather than shown wrong if Yahoo fails
    }
  }

  return NextResponse.json({
    startingCash: STARTING_CASH,
    cash: state.cash,
    totalValue,
    totalReturnPct,
    startedAt: state.startedAt,
    positions,
    trades,
    spyComparison,
  });
}
