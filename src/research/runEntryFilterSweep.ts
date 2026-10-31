// Tests two candidate ENTRY-side filters for the live paper bot, on top of
// the existing "STRONG BUY" entry rule and the current live exit rule
// (sellFamilyOnly) and risk stops — same methodology as every other sweep
// in this folder: one variable at a time, full period + both halves
// checked separately, same universe, same trading-cost model.
//
// Why these two: a same-day check on TSLA's own 5-year history (2026-10-27)
// found its STRONG BUY days underperform a coin flip 1-2 months out when
// the stock is already far above its 50-day average — and that the
// NASDAQ-100 (QQQ) itself tends to recover from readings like its current
// one. Both ideas are testable with data already in this project (no new
// data source), hence first priority.
//
// Run with: npx tsx src/research/runEntryFilterSweep.ts

import { fetchDailyHistory } from "./fetchDailyHistory";
import { getDailyCandles } from "../lib/yahoo";
import { buildSignalSeries, runSimulation, SimResult, DaySignal, EntryFilter } from "./simulatePaperBot";

function pct(x: number): string {
  return `${x >= 0 ? "+" : ""}${x.toFixed(1)}%`;
}

function summarize(label: string, r: SimResult) {
  const n = r.closedTrades.length;
  const wins = r.closedTrades.filter((t) => t.pnlPct > 0).length;
  const whipsaws = r.closedTrades.filter((t) => t.daysHeld <= 3).length;
  console.log(`  ${label}`);
  console.log(
    `    Total return: ${pct(r.totalReturnPct)}  |  trades: ${n}  |  win rate: ${
      n > 0 ? ((wins / n) * 100).toFixed(0) : "–"
    }%  |  whipsaws: ${n > 0 ? ((whipsaws / n) * 100).toFixed(0) : "–"}%  |  costs: $${r.totalCostsPaid.toFixed(0)}`
  );
}

async function main() {
  console.log("Loading full-universe daily history (cached)...\n");
  const history = await fetchDailyHistory();
  const { series, calendar } = buildSignalSeries(history);
  console.log(`${Object.keys(history.byTicker).length} tickers. Calendar: ${calendar[0]} to ${calendar[calendar.length - 1]} (${calendar.length} days)\n`);

  console.log("Fetching QQQ (Nasdaq-100 proxy) for the market-regime filter...\n");
  const qqqCandles = await getDailyCandles("QQQ", "2y");
  const { series: qqqSeriesMap } = buildSignalSeries({
    fetchedAt: new Date().toISOString(),
    byTicker: { QQQ: qqqCandles },
    excludedTickers: [],
  });
  const qqqByDate: Map<string, DaySignal> = qqqSeriesMap.get("QQQ")!;

  const midIdx = Math.floor(calendar.length / 2);
  const periods: { label: string; start: number; end: number }[] = [
    { label: "FULL PERIOD", start: 0, end: calendar.length },
    { label: "FIRST HALF", start: 0, end: midIdx },
    { label: "SECOND HALF", start: midIdx, end: calendar.length },
  ];

  // --- Variant 1: overextension brake, one cap at a time ---
  const overextensionCaps = [25, 20, 15, 10];
  const overextensionFilter = (cap: number): EntryFilter => (_ticker, _date, day) =>
    day.trendPctVsSma === null || day.trendPctVsSma <= cap;

  console.log("=".repeat(70));
  console.log("VARIANT 1: Overextension brake (skip STRONG BUY if already this far above its 50-day average)");
  console.log("=".repeat(70));
  for (const { label, start, end } of periods) {
    console.log(`\n${label} (${calendar[start]} to ${calendar[end - 1]}):`);
    summarize("Baseline (no cap, today's live rule)", runSimulation(series, calendar, start, end, "sellFamilyOnly"));
    for (const cap of overextensionCaps) {
      summarize(`Cap at +${cap}%`, runSimulation(series, calendar, start, end, "sellFamilyOnly", undefined, overextensionFilter(cap)));
    }
  }

  // --- Variant 2: market-regime filter (block new entries while QQQ itself is below its own 50-day average) ---
  const regimeFilter: EntryFilter = (_ticker, date) => {
    const qqqDay = qqqByDate.get(date);
    if (!qqqDay || qqqDay.trendPctVsSma === null) return true; // no data -> don't block
    return qqqDay.trendPctVsSma >= 0;
  };

  console.log(`\n${"=".repeat(70)}`);
  console.log("VARIANT 2: Market-regime filter (skip new entries while QQQ is below its own 50-day average)");
  console.log("=".repeat(70));
  for (const { label, start, end } of periods) {
    console.log(`\n${label} (${calendar[start]} to ${calendar[end - 1]}):`);
    summarize("Baseline (no filter, today's live rule)", runSimulation(series, calendar, start, end, "sellFamilyOnly"));
    summarize("Regime filter ON", runSimulation(series, calendar, start, end, "sellFamilyOnly", undefined, regimeFilter));
  }

  console.log("\nDone.\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
