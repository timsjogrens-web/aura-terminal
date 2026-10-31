// Checks the one gap paperTrading.ts's own comment already flags: the
// risk stops (8% stop-loss, 15%-gain-armed/10%-trail) are "standard
// swing-trading defaults... not values backtested specifically for this
// signal engine". This tests each one in isolation — holding the other
// two and the (now-live) exit rule fixed — the same single-variable-at-
// a-time discipline used for the entry bar and exit rule, rather than a
// full grid search over all combinations, which would multiply the
// number of trials (and the overfitting risk that comes with it) for a
// result this dataset can't actually support trusting.
//
// Run with: npx tsx src/research/runRiskParamSweep.ts

import { fetchDailyHistory } from "./fetchDailyHistory";
import { buildSignalSeries, runSimulation, DEFAULT_RISK_PARAMS, RiskParams, SimResult } from "./simulatePaperBot";

function maxDrawdownPct(dailyValues: number[]): number {
  let peak = dailyValues[0] ?? 0;
  let worst = 0;
  for (const v of dailyValues) {
    peak = Math.max(peak, v);
    worst = Math.max(worst, ((peak - v) / peak) * 100);
  }
  return worst;
}

function pct(x: number): string {
  return `${x >= 0 ? "+" : ""}${x.toFixed(1)}%`;
}

function summarize(label: string, r: SimResult) {
  const n = r.closedTrades.length;
  const wins = r.closedTrades.filter((t) => t.pnlPct > 0).length;
  const whipsaws = r.closedTrades.filter((t) => t.daysHeld <= 3).length;
  console.log(
    `    ${label.padEnd(13)} return ${pct(r.totalReturnPct).padEnd(7)} maxDD -${maxDrawdownPct(r.dailyValues).toFixed(0)}%`.padEnd(45) +
      `trades ${n} (${n > 0 ? ((wins / n) * 100).toFixed(0) : "–"}% win, ${n > 0 ? ((whipsaws / n) * 100).toFixed(0) : "–"}% whipsaw)`
  );
}

async function sweepOne(
  label: string,
  series: ReturnType<typeof buildSignalSeries>["series"],
  calendar: string[],
  midIdx: number,
  variants: { label: string; params: RiskParams }[]
) {
  console.log("=".repeat(70));
  console.log(label);
  console.log("=".repeat(70));
  for (const v of variants) {
    console.log(`  ${v.label}`);
    const full = runSimulation(series, calendar, 0, calendar.length, "sellFamilyOnly", v.params);
    const first = runSimulation(series, calendar, 0, midIdx, "sellFamilyOnly", v.params);
    const second = runSimulation(series, calendar, midIdx, calendar.length, "sellFamilyOnly", v.params);
    summarize("Full", full);
    summarize("First half", first);
    summarize("Second half", second);
  }
  console.log();
}

async function main() {
  const history = await fetchDailyHistory();
  const { series, calendar } = buildSignalSeries(history);
  const midIdx = Math.floor(calendar.length / 2);
  console.log(`${calendar[0]} to ${calendar[calendar.length - 1]} (${calendar.length} days), split at ${calendar[midIdx]}\n`);

  const d = DEFAULT_RISK_PARAMS;

  await sweepOne("STOP-LOSS (trailing arm/stop held at current defaults)", series, calendar, midIdx, [
    { label: "5%", params: { ...d, stopLossPct: 5 } },
    { label: "8% (current)", params: { ...d, stopLossPct: 8 } },
    { label: "10%", params: { ...d, stopLossPct: 10 } },
    { label: "12%", params: { ...d, stopLossPct: 12 } },
  ]);

  await sweepOne("TRAILING ARM % (stop-loss/trailing-stop held at current defaults)", series, calendar, midIdx, [
    { label: "10%", params: { ...d, trailingArmPct: 10 } },
    { label: "15% (current)", params: { ...d, trailingArmPct: 15 } },
    { label: "20%", params: { ...d, trailingArmPct: 20 } },
  ]);

  await sweepOne("TRAILING STOP % (stop-loss/trailing-arm held at current defaults)", series, calendar, midIdx, [
    { label: "7%", params: { ...d, trailingStopPct: 7 } },
    { label: "10% (current)", params: { ...d, trailingStopPct: 10 } },
    { label: "15%", params: { ...d, trailingStopPct: 15 } },
  ]);

  console.log("HONESTY NOTES");
  console.log("- Exit rule held at the now-live \"sellFamilyOnly\" throughout — this sweep is about the risk stops specifically, not re-litigating the exit rule.");
  console.log("- Each parameter varied alone, others at today's defaults — not a full grid search, to keep the number of trials (and the overfitting risk per trial) low.");
  console.log("- Same 2-year Yahoo window as every other sweep so far — not a true untouched holdout.");
}

main().catch((e) => {
  console.error("Risk param sweep failed:", e);
  process.exit(1);
});
