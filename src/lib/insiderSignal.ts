// Live version of the "insider cluster-buying" factor tested in
// src/research/insiderFactor.ts — same definition (distinct officers/
// directors who were net open-market buyers minus net sellers in the
// trailing window), just evaluated as of right now instead of as of a
// historical month-end, and read from the live `insider_trades` table
// instead of a research cache.
//
// This is NOT part of the 0-100 score or the STRONG BUY/.../STRONG SELL
// signal — see the Methodology page's "Den sjätte strategin" section for
// why: promising in a locked backtest, but not yet confirmed enough to
// blend into the trusted signal. It's shown as its own, separately
// labeled indicator instead.

import { db } from "./db";

export const INSIDER_SIGNAL_WINDOW_DAYS = 90;

export interface InsiderSignal {
  ticker: string;
  windowDays: number;
  buyers: string[]; // distinct owner names, net buyers in the window
  sellers: string[]; // distinct owner names, net sellers in the window
  netCount: number; // buyers.length - sellers.length
  hasData: boolean; // false = no insider_trades rows at all for this ticker (not "zero activity")
}

interface InsiderTradeRow {
  owner_name: string;
  transaction_code: string;
}

export async function getInsiderSignal(
  ticker: string,
  windowDays: number = INSIDER_SIGNAL_WINDOW_DAYS
): Promise<InsiderSignal> {
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  // Gated on filing_date, not transaction_date, same point-in-time-safe
  // rule the research backtest used — only trades that were actually
  // public within the window count.
  const res = await db.execute({
    sql: `SELECT owner_name, transaction_code FROM insider_trades
          WHERE ticker = ? AND filing_date >= ? AND transaction_code IN ('P', 'S')`,
    args: [ticker, since],
  });

  const anyRes = await db.execute({
    sql: `SELECT 1 FROM insider_trades WHERE ticker = ? LIMIT 1`,
    args: [ticker],
  });
  const hasData = anyRes.rows.length > 0;

  const buyers = new Set<string>();
  const sellers = new Set<string>();
  for (const row of res.rows as unknown as InsiderTradeRow[]) {
    if (row.transaction_code === "P") buyers.add(row.owner_name);
    else if (row.transaction_code === "S") sellers.add(row.owner_name);
  }

  return {
    ticker,
    windowDays,
    buyers: [...buyers],
    sellers: [...sellers],
    netCount: buyers.size - sellers.size,
    hasData,
  };
}
