// Orchestrates the Fas 2 strategy research: fetch history, split into a
// research period and a LOCKED hold-out period, run each factor strategy
// using ONLY the research period to decide anything, then report both
// periods' stats honestly — including the hold-out, whatever it shows.
//
// Run with: npx tsx src/research/runResearch.ts [default|sp500]
// "sp500" uses the full current S&P 500 constituent list instead of the
// site's hand-picked 39 tickers — see sp500Universe.ts for why that's a
// fairer (though still not survivorship-bias-free) starting universe.

import { fetchUniverseMonthlyHistory, BENCHMARK_TICKER, UniverseChoice } from "./fetchHistory";
import { fetchInsiderHistory } from "./fetchInsiderHistory";
import { buildInsiderMonthlyScores } from "./insiderFactor";
import {
  momentumScorer,
  lowVolScorer,
  shortTermReversalScorer,
  fiftyTwoWeekHighScorer,
  runFactorStrategy,
  runEqualWeightUniverse,
  runCompositeRankStrategy,
  runInsiderFactorStrategy,
  runInsiderCompositeStrategy,
  StrategyResult,
} from "./strategies";
import {
  cagr,
  annualizedVol,
  sharpeRatio,
  maxDrawdown,
  alphaBeta,
  deflatedSharpeRatio,
} from "./stats";

const HOLDOUT_MONTHS = 24; // locked, never used to pick a strategy or tune parameters

const universeArg = (process.argv[2] as UniverseChoice) ?? "default";
if (universeArg !== "default" && universeArg !== "sp500") {
  console.error(`Unknown universe "${universeArg}" — use "default" or "sp500".`);
  process.exit(1);
}
// Insider cluster-buying (and its composite with low-vol) only has data
// for the CORE_UNIVERSE (41 tickers — see universe.ts), so both are only
// run against the default universe, not sp500. momentum, low-vol,
// composite, short-term reversal, 52-week-high, (+ insider cluster-buying
// and insider+low-vol composite on "default" only) — every variant
// actually being compared. Raising this when a new strategy is added is
// the honest move: more trials means a real Sharpe ratio needs to clear a
// higher bar before it's trustworthy, not a lower one.
const NUM_TRIALS = universeArg === "default" ? 7 : 5;
// The brief specifies 20-30 stock portfolios; with only 37 eligible names
// in the hand-picked universe that would barely be a "top N" at all, so it
// stays smaller there. With the ~460-name S&P 500 universe, 25 matches the
// brief directly. Fixed BEFORE looking at either universe's results — not
// tuned to flatter one over the other.
const TOP_N = universeArg === "sp500" ? 25 : 12;

function statsFor(monthlyReturns: number[], portfolioValue: number[], benchReturns: number[]) {
  const ab = alphaBeta(monthlyReturns, benchReturns);
  return {
    months: monthlyReturns.length,
    cagr: cagr(portfolioValue),
    vol: annualizedVol(monthlyReturns),
    sharpe: sharpeRatio(monthlyReturns),
    maxDrawdown: maxDrawdown(portfolioValue),
    alphaAnnual: ab.alphaAnnual,
    beta: ab.beta,
    tStatAlpha: ab.tStatAlpha,
  };
}

function pct(x: number): string {
  return `${(x * 100).toFixed(2)}%`;
}

function printStats(label: string, s: ReturnType<typeof statsFor>, dsr?: number) {
  console.log(`  ${label}`);
  console.log(`    Months evaluated:  ${s.months}`);
  console.log(`    CAGR:              ${pct(s.cagr)}`);
  console.log(`    Volatility (ann.): ${pct(s.vol)}`);
  console.log(`    Sharpe ratio:      ${s.sharpe.toFixed(2)}`);
  console.log(`    Max drawdown:      ${pct(s.maxDrawdown)}`);
  console.log(`    Alpha (ann.):      ${pct(s.alphaAnnual)}  (t-stat: ${s.tStatAlpha.toFixed(2)})`);
  console.log(`    Beta vs SPY:       ${s.beta.toFixed(2)}`);
  if (dsr !== undefined) {
    console.log(`    Deflated Sharpe:   ${dsr.toFixed(3)}  (probability this Sharpe beats ${NUM_TRIALS} trials' worth of luck)`);
  }
}

function splitReturns(result: StrategyResult, cutMonth: string) {
  const cutIdx = result.months.findIndex((m) => m >= cutMonth);
  const idx = cutIdx === -1 ? result.months.length : cutIdx;
  return {
    research: {
      monthlyReturns: result.monthlyReturns.slice(0, idx),
      portfolioValue: result.portfolioValue.slice(0, idx + 1),
    },
    holdout: {
      monthlyReturns: result.monthlyReturns.slice(idx),
      portfolioValue: result.portfolioValue.slice(idx),
    },
  };
}

async function main() {
  console.log(`Universe: ${universeArg}`);
  console.log("Fetching / loading cached monthly history for the universe + SPY...\n");
  const panel = await fetchUniverseMonthlyHistory({ universe: universeArg });
  console.log(`Panel: ${panel.months.length} common months, ${Object.keys(panel.prices).length - 1} tickers + SPY.`);
  if (panel.excludedTickers.length > 0) {
    console.log("Excluded from research panel:");
    for (const x of panel.excludedTickers) console.log(`  - ${x.ticker}: ${x.reason}`);
  }
  console.log(`Range: ${panel.months[0]} to ${panel.months[panel.months.length - 1]}\n`);

  const cutIdx = panel.months.length - HOLDOUT_MONTHS;
  const cutMonth = panel.months[cutIdx];
  console.log(`Locked hold-out period: ${cutMonth} onward (${HOLDOUT_MONTHS} months, never used to pick or tune anything above).\n`);

  const startIdx = 12; // first month with enough history for a 12-month lookback
  const endIdxExclusive = panel.months.length;

  const strategies: { label: string; result: StrategyResult }[] = [
    { label: "Momentum (12-1)", result: runFactorStrategy(panel, momentumScorer, TOP_N, startIdx, endIdxExclusive) },
    { label: "Low-volatility", result: runFactorStrategy(panel, lowVolScorer, TOP_N, startIdx, endIdxExclusive) },
    {
      label: "Composite (momentum + low-vol)",
      result: runCompositeRankStrategy(panel, [momentumScorer, lowVolScorer], TOP_N, startIdx, endIdxExclusive),
    },
    {
      label: "Short-term reversal (1mo)",
      result: runFactorStrategy(panel, shortTermReversalScorer, TOP_N, startIdx, endIdxExclusive),
    },
    {
      label: "52-week-high proximity",
      result: runFactorStrategy(panel, fiftyTwoWeekHighScorer, TOP_N, startIdx, endIdxExclusive),
    },
  ];

  if (universeArg === "default") {
    console.log("Fetching / loading cached insider (SEC Form 4) history for the universe...\n");
    const insiderHistory = await fetchInsiderHistory();
    const insiderScores = buildInsiderMonthlyScores(insiderHistory.byTicker, panel.months);
    const tickersWithData = [...insiderScores.values()].filter((s) => s.some((x) => x !== null)).length;
    console.log(`Insider data: ${tickersWithData}/${panel.months.length > 0 ? Object.keys(panel.prices).length - 1 : 0} tickers have at least one usable month.\n`);
    strategies.push({
      label: "Insider cluster-buying (90d net)",
      result: runInsiderFactorStrategy(panel, insiderScores, TOP_N, startIdx, endIdxExclusive),
    });
    strategies.push({
      label: "Insider cluster-buying + low-vol (composite rank)",
      result: runInsiderCompositeStrategy(panel, insiderScores, lowVolScorer, TOP_N, startIdx, endIdxExclusive),
    });
  }

  const benchmarks: { label: string; result: StrategyResult }[] = [
    { label: "Equal-weight universe (all tickers)", result: runEqualWeightUniverse(panel, startIdx, endIdxExclusive) },
  ];

  // SPY as its own "strategy" (buy and hold, monthly-sampled) purely to get its monthlyReturns/portfolioValue in the same shape.
  const spyPrices = panel.prices[BENCHMARK_TICKER].slice(startIdx);
  const spyMonths = panel.months.slice(startIdx);
  const spyMonthlyReturns: number[] = [];
  const spyPortfolioValue = [1.0];
  for (let i = 1; i < spyPrices.length; i++) {
    const r = spyPrices[i] / spyPrices[i - 1] - 1;
    spyMonthlyReturns.push(r);
    spyPortfolioValue.push(spyPortfolioValue[spyPortfolioValue.length - 1] * (1 + r));
  }
  const spyResult: StrategyResult = {
    months: spyMonths.slice(1),
    monthlyReturns: spyMonthlyReturns,
    portfolioValue: spyPortfolioValue,
    holdings: [],
  };

  const spySplit = splitReturns(spyResult, cutMonth);

  console.log("=".repeat(70));
  console.log("BENCHMARK: S&P 500 (SPY), total return");
  console.log("=".repeat(70));
  printStats("Research period", statsFor(spySplit.research.monthlyReturns, spySplit.research.portfolioValue, spySplit.research.monthlyReturns));
  printStats("Hold-out period (locked)", statsFor(spySplit.holdout.monthlyReturns, spySplit.holdout.portfolioValue, spySplit.holdout.monthlyReturns));
  console.log();

  for (const b of benchmarks) {
    const split = splitReturns(b.result, cutMonth);
    console.log("=".repeat(70));
    console.log(`BENCHMARK: ${b.label}`);
    console.log("=".repeat(70));
    printStats("Research period", statsFor(split.research.monthlyReturns, split.research.portfolioValue, spySplit.research.monthlyReturns));
    printStats("Hold-out period (locked)", statsFor(split.holdout.monthlyReturns, split.holdout.portfolioValue, spySplit.holdout.monthlyReturns));
    console.log();
  }

  for (const s of strategies) {
    const split = splitReturns(s.result, cutMonth);
    const dsrResearch = deflatedSharpeRatio(split.research.monthlyReturns, NUM_TRIALS);
    console.log("=".repeat(70));
    console.log(`STRATEGY: ${s.label}  (top ${TOP_N}, equal-weighted, monthly rebalance)`);
    console.log("=".repeat(70));
    printStats("Research period", statsFor(split.research.monthlyReturns, split.research.portfolioValue, spySplit.research.monthlyReturns), dsrResearch);
    printStats("Hold-out period (locked)", statsFor(split.holdout.monthlyReturns, split.holdout.portfolioValue, spySplit.holdout.monthlyReturns));
    console.log();
  }

  console.log("=".repeat(70));
  console.log("HONESTY NOTES");
  console.log("=".repeat(70));
  console.log(
    universeArg === "sp500"
      ? `- Universe is the CURRENT S&P 500 constituent list — fairer than a hand-picked list, but still NOT survivorship-bias-free (companies removed from the index before today aren't included).`
      : `- Universe is the site's hand-picked 39 tickers, NOT survivorship-bias-free (no delisted/failed companies included).`
  );
  console.log(`- Price-based factors use only point-in-time price history. Quality/value need fundamentals data that's only available as today's snapshot from free sources — using it for historical decisions would be look-ahead bias, so it's excluded rather than faked. PEAD was investigated and ruled out for the same reason: Finnhub's free tier only returns the last 4 quarters of earnings-surprise history per ticker, not enough for a real backtest.`);
  if (universeArg === "default") {
    console.log(`- Insider cluster-buying factor is gated on SEC Form 4 filing date (not transaction date), so it never "knows" about a trade before it was actually public. Backfilled from 2015 onward; earlier months in the panel may have thin or no insider data (fewer public officers/directors filed, or EDGAR's history for a given CIK starts later), which shrinks the eligible pool those months rather than fabricating a score.`);
  }
  console.log(`- No trading costs applied in this research pass (that's modeled separately in the live backtest tool, not here yet).`);
  console.log(`- Deflated Sharpe Ratio is an approximation (see stats.ts) — a rigorous estimate, not a guarantee.`);
  console.log(`- Hold-out numbers above were computed in this same run as the research numbers — parameters (TOP_N, lookback windows) were fixed by academic convention BEFORE looking at this data, not tuned on it.`);
}

main().catch((e) => {
  console.error("Research run failed:", e);
  process.exit(1);
});
