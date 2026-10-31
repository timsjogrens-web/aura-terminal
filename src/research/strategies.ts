// Long-only, monthly-rebalanced factor strategies, built only from price
// history (no fundamentals — point-in-time fundamentals data isn't
// available from our free sources, see the research report). Each scorer
// looks only at prices[0..idx], never anything after idx — that's the
// look-ahead-safety property this module depends on and that
// runFactorStrategy's tests check for.

import type { MonthlySeries } from "./fetchHistory";
import type { InsiderMonthlyScores } from "./insiderFactor";

export type FactorScorer = (prices: number[], idx: number) => number | null;

// Classic 12-1 momentum: total return from 12 months ago to 1 month ago,
// deliberately skipping the most recent month (the "1" in "12-1") because
// short-horizon returns tend to mean-revert rather than continue —
// including them would mix two opposite effects into one signal.
export const momentumScorer: FactorScorer = (prices, idx) => {
  if (idx < 12) return null;
  const p12 = prices[idx - 12];
  const p1 = prices[idx - 1];
  if (!p12 || !p1) return null;
  return p1 / p12 - 1;
};

// Low-volatility: negative trailing 12-month return std dev, so "higher
// score" consistently means "more attractive" across every scorer, same as
// momentum above.
export const lowVolScorer: FactorScorer = (prices, idx) => {
  if (idx < 12) return null;
  const rets: number[] = [];
  for (let i = idx - 11; i <= idx; i++) {
    if (!prices[i - 1] || !prices[i]) return null;
    rets.push(prices[i] / prices[i - 1] - 1);
  }
  const m = rets.reduce((a, b) => a + b, 0) / rets.length;
  const variance = rets.reduce((a, b) => a + (b - m) ** 2, 0) / (rets.length - 1);
  return -Math.sqrt(variance);
};

// Short-term reversal: negative of the most recent month's return — the
// opposite bet from momentum's skipped "-1" month. Academically documented
// (Jegadeesh 1990) as a distinct, short-horizon effect from 12-1 momentum,
// not a contradiction of it. Price-only, so no point-in-time risk.
export const shortTermReversalScorer: FactorScorer = (prices, idx) => {
  if (idx < 1) return null;
  const p0 = prices[idx - 1];
  const p1 = prices[idx];
  if (!p0 || !p1) return null;
  return -(p1 / p0 - 1);
};

// 52-week-high proximity (George & Hwang 2004): current price as a
// fraction of its trailing-12-month high. Closer to the high (ratio near
// 1.0) scores better. A related but distinct signal from 12-1 momentum —
// it's about distance to a specific reference price, not total return.
export const fiftyTwoWeekHighScorer: FactorScorer = (prices, idx) => {
  if (idx < 11) return null;
  let high = -Infinity;
  for (let i = idx - 11; i <= idx; i++) {
    if (!prices[i]) return null;
    high = Math.max(high, prices[i]);
  }
  if (!prices[idx] || high <= 0) return null;
  return prices[idx] / high;
};

export interface StrategyResult {
  months: string[]; // one per rebalance-to-rebalance step (length = panel.months.length - startIdx - 1)
  portfolioValue: number[]; // starts at 1.0, length = months.length + 1
  monthlyReturns: number[]; // length = months.length
  holdings: { month: string; tickers: string[] }[];
}

// Ranks every eligible ticker by `scorer` at each month, holds the top
// `topN` equal-weighted for that month, then re-ranks and rebalances. Only
// ever looks at prices[0..idx] for the month it's deciding — no future data
// used, which is what the look-ahead test in strategies.test.ts checks.
export function runFactorStrategy(
  panel: MonthlySeries,
  scorer: FactorScorer,
  topN: number,
  startIdx: number,
  endIdxExclusive: number // panel index to stop before (for splitting research/holdout)
): StrategyResult {
  const tickers = Object.keys(panel.prices);
  const months: string[] = [];
  const monthlyReturns: number[] = [];
  const holdings: { month: string; tickers: string[] }[] = [];
  const portfolioValue: number[] = [1.0];

  for (let idx = startIdx; idx < endIdxExclusive - 1; idx++) {
    const scored = tickers
      .map((t) => ({ t, score: scorer(panel.prices[t], idx) }))
      .filter((x): x is { t: string; score: number } => x.score !== null)
      .sort((a, b) => b.score - a.score);

    const picked = scored.slice(0, topN).map((x) => x.t);
    holdings.push({ month: panel.months[idx], tickers: picked });

    if (picked.length === 0) {
      months.push(panel.months[idx + 1]);
      monthlyReturns.push(0);
      portfolioValue.push(portfolioValue[portfolioValue.length - 1]);
      continue;
    }

    const rets = picked.map((t) => panel.prices[t][idx + 1] / panel.prices[t][idx] - 1);
    const portRet = rets.reduce((a, b) => a + b, 0) / rets.length;

    months.push(panel.months[idx + 1]);
    monthlyReturns.push(portRet);
    portfolioValue.push(portfolioValue[portfolioValue.length - 1] * (1 + portRet));
  }

  return { months, portfolioValue, monthlyReturns, holdings };
}

// Same top-N, equal-weight, monthly-rebalance mechanics as
// runFactorStrategy, but ranked from a precomputed ticker+month score
// table (see insiderFactor.ts) instead of a price-only scorer function —
// the insider factor needs to know WHICH ticker it's scoring, which the
// shared `FactorScorer` signature (prices array only, no ticker) can't
// express without changing that tested, price-only contract for every
// existing strategy. Tickers with a null score that month (no insider
// data) are excluded from that month's ranking, same convention as a
// null from any FactorScorer.
export function runInsiderFactorStrategy(
  panel: MonthlySeries,
  scores: InsiderMonthlyScores,
  topN: number,
  startIdx: number,
  endIdxExclusive: number
): StrategyResult {
  const tickers = Object.keys(panel.prices).filter((t) => scores.has(t));
  const months: string[] = [];
  const monthlyReturns: number[] = [];
  const holdings: { month: string; tickers: string[] }[] = [];
  const portfolioValue: number[] = [1.0];

  for (let idx = startIdx; idx < endIdxExclusive - 1; idx++) {
    const scored = tickers
      .map((t) => ({ t, score: scores.get(t)![idx] }))
      .filter((x): x is { t: string; score: number } => x.score !== null && x.score !== undefined)
      // Higher net cluster-buying first; ties broken by ticker for determinism.
      .sort((a, b) => b.score - a.score || a.t.localeCompare(b.t));

    const picked = scored.slice(0, topN).map((x) => x.t);
    holdings.push({ month: panel.months[idx], tickers: picked });

    if (picked.length === 0) {
      months.push(panel.months[idx + 1]);
      monthlyReturns.push(0);
      portfolioValue.push(portfolioValue[portfolioValue.length - 1]);
      continue;
    }

    const rets = picked.map((t) => panel.prices[t][idx + 1] / panel.prices[t][idx] - 1);
    const portRet = rets.reduce((a, b) => a + b, 0) / rets.length;

    months.push(panel.months[idx + 1]);
    monthlyReturns.push(portRet);
    portfolioValue.push(portfolioValue[portfolioValue.length - 1] * (1 + portRet));
  }

  return { months, portfolioValue, monthlyReturns, holdings };
}

// Combines the insider-clustering rank with ONE price-based factor's rank
// (cross-sectional average, same method as runCompositeRankStrategy) —
// tries to answer whether pairing insider-clustering with something else
// tames its own -32% max-drawdown result (see methodology page) rather
// than whether it beats the market on return alone. low-vol specifically
// was picked as the pairing because reducing drawdown is its whole
// purpose, not because it was the best-scoring option out of several
// tried — picking from several after seeing results is how this project's
// other factors avoid overfitting, and this keeps the same discipline.
// A ticker needs a real score on BOTH factors that month to be eligible —
// same "no partial-data shortcuts" rule as the existing composite.
export function runInsiderCompositeStrategy(
  panel: MonthlySeries,
  insiderScores: InsiderMonthlyScores,
  priceScorer: FactorScorer,
  topN: number,
  startIdx: number,
  endIdxExclusive: number
): StrategyResult {
  const tickers = Object.keys(panel.prices).filter((t) => insiderScores.has(t));
  const months: string[] = [];
  const monthlyReturns: number[] = [];
  const holdings: { month: string; tickers: string[] }[] = [];
  const portfolioValue: number[] = [1.0];

  for (let idx = startIdx; idx < endIdxExclusive - 1; idx++) {
    const insiderRanked = tickers
      .map((t) => ({ t, score: insiderScores.get(t)![idx] }))
      .filter((x): x is { t: string; score: number } => x.score !== null && x.score !== undefined)
      .sort((a, b) => b.score - a.score || a.t.localeCompare(b.t));
    const insiderRank = new Map(insiderRanked.map((x, i) => [x.t, i + 1]));

    const priceRanked = tickers
      .map((t) => ({ t, score: priceScorer(panel.prices[t], idx) }))
      .filter((x): x is { t: string; score: number } => x.score !== null)
      .sort((a, b) => b.score - a.score);
    const priceRank = new Map(priceRanked.map((x, i) => [x.t, i + 1]));

    const avgRank = tickers
      .map((t) => {
        const ir = insiderRank.get(t);
        const pr = priceRank.get(t);
        if (ir === undefined || pr === undefined) return null;
        return { t, avg: (ir + pr) / 2 };
      })
      .filter((x): x is { t: string; avg: number } => x !== null)
      .sort((a, b) => a.avg - b.avg);

    const picked = avgRank.slice(0, topN).map((x) => x.t);
    holdings.push({ month: panel.months[idx], tickers: picked });

    if (picked.length === 0) {
      months.push(panel.months[idx + 1]);
      monthlyReturns.push(0);
      portfolioValue.push(portfolioValue[portfolioValue.length - 1]);
      continue;
    }

    const rets = picked.map((t) => panel.prices[t][idx + 1] / panel.prices[t][idx] - 1);
    const portRet = rets.reduce((a, b) => a + b, 0) / rets.length;

    months.push(panel.months[idx + 1]);
    monthlyReturns.push(portRet);
    portfolioValue.push(portfolioValue[portfolioValue.length - 1] * (1 + portRet));
  }

  return { months, portfolioValue, monthlyReturns, holdings };
}

// Benchmark: hold every ticker with data at that month, equal-weighted,
// rebalanced monthly. This is the "equal-weighted version of the universe"
// comparison the brief asked for, distinct from SPY.
export function runEqualWeightUniverse(
  panel: MonthlySeries,
  startIdx: number,
  endIdxExclusive: number
): StrategyResult {
  return runFactorStrategy(panel, () => 1, Object.keys(panel.prices).length, startIdx, endIdxExclusive);
}

// Equal-weighted composite of momentum + low-vol: momentum is a return
// (e.g. 0.15) and low-vol is a negative std dev (e.g. -0.05) — averaging
// those raw numbers directly would let momentum's larger scale dominate.
// Instead this cross-sectionally RANKS every ticker on each factor at each
// month, averages the two ranks, and picks the top `topN` by that average —
// the standard way to combine factors on different scales.
export function runCompositeRankStrategy(
  panel: MonthlySeries,
  scorers: FactorScorer[],
  topN: number,
  startIdx: number,
  endIdxExclusive: number
): StrategyResult {
  const tickers = Object.keys(panel.prices);
  const months: string[] = [];
  const monthlyReturns: number[] = [];
  const holdings: { month: string; tickers: string[] }[] = [];
  const portfolioValue: number[] = [1.0];

  for (let idx = startIdx; idx < endIdxExclusive - 1; idx++) {
    // Rank tickers 1..N per factor (1 = best), only among tickers that have
    // a score for that factor; average each ticker's ranks across factors
    // it was scored on, and require it be scored on every factor to be
    // eligible (keeps the composite comparable, no partial-data shortcuts).
    const perFactorRanks: Map<string, number>[] = scorers.map((scorer) => {
      const ranked = tickers
        .map((t) => ({ t, score: scorer(panel.prices[t], idx) }))
        .filter((x): x is { t: string; score: number } => x.score !== null)
        .sort((a, b) => b.score - a.score);
      return new Map(ranked.map((x, i) => [x.t, i + 1]));
    });

    const avgRank = tickers
      .map((t) => {
        const ranks = perFactorRanks.map((m) => m.get(t));
        if (ranks.some((r) => r === undefined)) return null;
        const avg = (ranks as number[]).reduce((a, b) => a + b, 0) / ranks.length;
        return { t, avg };
      })
      .filter((x): x is { t: string; avg: number } => x !== null)
      .sort((a, b) => a.avg - b.avg); // lower average rank = better

    const picked = avgRank.slice(0, topN).map((x) => x.t);
    holdings.push({ month: panel.months[idx], tickers: picked });

    if (picked.length === 0) {
      months.push(panel.months[idx + 1]);
      monthlyReturns.push(0);
      portfolioValue.push(portfolioValue[portfolioValue.length - 1]);
      continue;
    }

    const rets = picked.map((t) => panel.prices[t][idx + 1] / panel.prices[t][idx] - 1);
    const portRet = rets.reduce((a, b) => a + b, 0) / rets.length;

    months.push(panel.months[idx + 1]);
    monthlyReturns.push(portRet);
    portfolioValue.push(portfolioValue[portfolioValue.length - 1] * (1 + portRet));
  }

  return { months, portfolioValue, monthlyReturns, holdings };
}
