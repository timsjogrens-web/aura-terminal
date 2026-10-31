// Shows, honestly, what it would cost in drawdown to push the live
// strategy's return toward a specific target (e.g. 100%/year) by adding
// leverage instead of finding a genuinely better rule. See
// leverageAnalysis.ts for the method and its limitations.
//
// Run with: npx tsx src/research/runLeverageSweep.ts

import { fetchDailyHistory } from "./fetchDailyHistory";
import { buildSignalSeries, runSimulation } from "./simulatePaperBot";
import { applyLeverage } from "./leverageAnalysis";

const LEVERAGE_LEVELS = [1, 2, 3, 4, 5, 8, 12, 20, 30];

async function main() {
  console.log("Loading cached daily history and running the current live exit rule...\n");
  const history = await fetchDailyHistory();
  const { series, calendar } = buildSignalSeries(history);
  const base = runSimulation(series, calendar, 0, calendar.length, "sellFamilyOnly");

  const years = (base.dailyValues.length - 1) / 252;
  const baseAnnualized = (Math.pow(base.dailyValues[base.dailyValues.length - 1] / base.dailyValues[0], 1 / years) - 1) * 100;
  console.log(`Base strategy (current live rule), ${calendar[0]} to ${calendar[calendar.length - 1]} (${years.toFixed(1)} years):`);
  console.log(`  Total return:      ${base.totalReturnPct.toFixed(1)}%`);
  console.log(`  Annualized return: ${baseAnnualized.toFixed(1)}%/year\n`);

  console.log("Leverage".padEnd(10) + "Annualized".padEnd(14) + "Max drawdown".padEnd(16) + "Outcome");
  console.log("-".repeat(60));
  for (const lev of LEVERAGE_LEVELS) {
    const r = applyLeverage(base.dailyValues, lev);
    const outcome = r.wipedOut ? "WIPED OUT (margin call)" : "survived";
    console.log(
      `${lev}x`.padEnd(10) +
        `${r.annualizedReturnPct >= 0 ? "+" : ""}${r.annualizedReturnPct.toFixed(0)}%/yr`.padEnd(14) +
        `-${r.maxDrawdownPct.toFixed(0)}%`.padEnd(16) +
        outcome
    );
  }

  console.log("\nHONESTY NOTES");
  console.log("- No margin-call modeling beyond 'a single day down >=100% ends the account' — a real leveraged/margin account can be forcibly closed intraday at a worse price than this assumes, so real risk at any leverage level above is probably UNDERSTATED here, not exaggerated.");
  console.log("- No cost of leverage (margin interest, swap fees) — real returns at any leverage level would be lower than shown.");
  console.log("- This is the SAME historical period already used to evaluate the exit rule — leverage doesn't create a new edge, it only rescales the existing one's gains and losses together.");
}

main().catch((e) => {
  console.error("Leverage sweep failed:", e);
  process.exit(1);
});
