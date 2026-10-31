// Insider cluster-buying factor: distinct officers/directors who were net
// buyers minus net sellers (open-market P/S transactions only, see
// secForm4.ts) in the trailing 90 days as of each month-end. Multiple
// insiders buying together in a short window is the specific pattern with
// real academic support (Lakonishok & Lee 2001; Jeng, Metrick & Zeckhauser
// 2003) — a single insider's trade is weak evidence on its own (could be
// for any personal reason), but several independent insiders buying at
// once is much harder to explain away as coincidence.
//
// This is point-in-time safe: the gate is `filingDate` (when the trade
// became public), never `transactionDate` — using the transaction date
// instead would let the backtest "know" about a trade before anyone
// outside the company actually could have.

import { InsiderTransaction } from "../lib/secForm4";

// Null = no insider data at all for this ticker this month (excluded from
// ranking, same convention as the price-only scorers in strategies.ts).
// A real score of 0 means "we do have insider data for this ticker, it
// just shows no net cluster buying or selling in the window" — a
// meaningfully different, non-missing answer.
export type InsiderMonthlyScores = Map<string, (number | null)[]>; // ticker -> score per panel month index

function lastDayOfMonth(monthKey: string): Date {
  const [y, m] = monthKey.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)); // day 0 of next month = last day of this one
}

const LOOKBACK_DAYS = 90;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Builds a ticker -> per-month score array aligned 1:1 with `months`
 * (same array the price research panel uses), from each ticker's raw P/S
 * transaction history. A ticker missing from `byTicker` (CIK lookup or
 * fetch failure) gets an all-null row rather than being silently dropped,
 * so callers can see exactly which tickers had no usable insider data.
 */
export function buildInsiderMonthlyScores(
  byTicker: Record<string, InsiderTransaction[]>,
  months: string[]
): InsiderMonthlyScores {
  const result: InsiderMonthlyScores = new Map();

  for (const [ticker, txns] of Object.entries(byTicker)) {
    if (txns.length === 0) {
      result.set(ticker, months.map(() => null));
      continue;
    }

    const scores = months.map((monthKey) => {
      const decisionDate = lastDayOfMonth(monthKey);
      const windowStart = decisionDate.getTime() - LOOKBACK_DAYS * MS_PER_DAY;

      const buyers = new Set<string>();
      const sellers = new Set<string>();
      for (const t of txns) {
        const filed = new Date(t.filingDate).getTime();
        // Filed on or before the decision date (point-in-time safety),
        // and within the trailing window.
        if (filed > decisionDate.getTime() || filed < windowStart) continue;
        if (t.transactionCode === "P") buyers.add(t.ownerName);
        else if (t.transactionCode === "S") sellers.add(t.ownerName);
      }
      return buyers.size - sellers.size;
    });

    result.set(ticker, scores);
  }

  return result;
}
