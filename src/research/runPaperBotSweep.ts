// Compares candidate exit rules for the live paper bot against the
// current one, under identical conditions (same entry rule — STRONG BUY
// only, already backtested separately — same risk stops, same universe,
// same trading costs). See simulatePaperBot.ts for why this exists.
//
// Run with: npx tsx src/research/runPaperBotSweep.ts

import { fetchDailyHistory } from "./fetchDailyHistory";
import { buildSignalSeries, runSimulation, EXIT_VARIANT_LABELS, ExitVariant, SimResult } from "./simulatePaperBot";

const VARIANTS: ExitVariant[] = ["baseline", "sellFamilyOnly", "confirm2day", "minHold5"];

function pct(x: number): string {
  return `${x >= 0 ? "+" : ""}${x.toFixed(1)}%`;
}

function summarize(label: string, r: SimResult) {
  const n = r.closedTrades.length;
  const wins = r.closedTrades.filter((t) => t.pnlPct > 0).length;
  const whipsaws = r.closedTrades.filter((t) => t.daysHeld <= 3).length;
  const avgDaysHeld = n > 0 ? r.closedTrades.reduce((a, t) => a + t.daysHeld, 0) / n : 0;
  console.log(`  ${label}`);
  console.log(`    Total return:        ${pct(r.totalReturnPct)}  (final value $${r.finalValue.toFixed(0)})`);
  console.log(`    Closed trades:       ${n}  (${wins} wins, ${n > 0 ? ((wins / n) * 100).toFixed(0) : "–"}% win rate)`);
  console.log(`    Avg days held:       ${avgDaysHeld.toFixed(1)}`);
  console.log(`    Whipsaws (<=3 days): ${whipsaws}  (${n > 0 ? ((whipsaws / n) * 100).toFixed(0) : "–"}% of all closed trades)`);
  console.log(`    Trading costs paid:  $${r.totalCostsPaid.toFixed(0)}`);
}

async function main() {
  console.log("Fetching / loading cached daily history for the full live-trading universe...\n");
  const history = await fetchDailyHistory();
  const tickerCount = Object.keys(history.byTicker).length;
  console.log(`${tickerCount} tickers loaded. Excluded: ${history.excludedTickers.length}\n`);

  const { series, calendar } = buildSignalSeries(history);
  console.log(`Calendar: ${calendar[0]} to ${calendar[calendar.length - 1]} (${calendar.length} trading days)\n`);

  const midIdx = Math.floor(calendar.length / 2);
  console.log(`First half:  ${calendar[0]} to ${calendar[midIdx - 1]}`);
  console.log(`Second half: ${calendar[midIdx]} to ${calendar[calendar.length - 1]}\n`);

  for (const variant of VARIANTS) {
    console.log("=".repeat(70));
    console.log(`EXIT RULE: ${EXIT_VARIANT_LABELS[variant]}`);
    console.log("=".repeat(70));
    const full = runSimulation(series, calendar, 0, calendar.length, variant);
    const first = runSimulation(series, calendar, 0, midIdx, variant);
    const second = runSimulation(series, calendar, midIdx, calendar.length, variant);
    summarize("Full period", full);
    summarize("First half", first);
    summarize("Second half", second);
    console.log();
  }

  console.log("=".repeat(70));
  console.log("HONESTY NOTES");
  console.log("=".repeat(70));
  console.log("- Entry rule (STRONG BUY only) and risk stops (8% stop-loss, 15%-gain-armed/10%-trail) held fixed across every variant — only the signal-based exit condition changes, so this isolates that one variable.");
  console.log("- Execution and signal both use the same day's close (a simplification — the live bot reacts near-continuously intraday via scheduled refreshes, not once per day at the close) — relative comparison between variants is the point, not absolute fidelity to live fills.");
  console.log("- Trading costs (commission + FX + liquidity-tiered slippage) applied on every buy and sell via tradingCosts.ts, same model the Backtest tool uses.");
  console.log("- \"First half\" / \"second half\" split is the same robustness check used when the entry bar (score>=70) was picked — a result only worth trusting if it holds in both, not just on average.");
  console.log("- This is 2 years of real Yahoo history for ~167 tickers — not a true, never-touched holdout (there's no more free history further back to hold out), so treat this as a sanity check on an obvious failure mode (whipsaws), not a rigorously proven edge the way the 6 factor strategies were tested.");
}

main().catch((e) => {
  console.error("Sweep failed:", e);
  process.exit(1);
});
