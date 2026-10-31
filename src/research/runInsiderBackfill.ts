// Thin CLI entry point for fetchInsiderHistory.ts — kept separate from
// that file (which stays a pure library module, importable from
// runResearch.ts without triggering a multi-minute SEC EDGAR crawl as a
// side effect) same way runResearch.ts itself is the CLI entry point for
// fetchHistory.ts's library-only fetchUniverseMonthlyHistory.
//
// Run with: npx tsx src/research/runInsiderBackfill.ts
// Takes a while (thousands of polite, rate-limited SEC EDGAR requests) —
// result is cached to src/research/.cache/insider-history.json afterward,
// so runResearch.ts's own call to fetchInsiderHistory() just reads that
// cache instead of re-crawling.

import { backfillInsiderHistory } from "./fetchInsiderHistory";
import { CORE_UNIVERSE } from "../lib/universe";

async function main() {
  console.log(`Backfilling Form 4 history for ${CORE_UNIVERSE.length} tickers...`);
  console.log("This hits SEC EDGAR a few thousand times at a polite rate — expect this to take a while.");
  console.log("Resumable: safe to stop and re-run, already-fetched tickers won't be re-fetched.\n");
  const result = await backfillInsiderHistory();
  const total = Object.values(result.byTicker).reduce((a, txns) => a + txns.length, 0);
  console.log(`\nDone. ${total} total P/S transactions across ${Object.keys(result.byTicker).length} tickers.`);
  if (result.skipped.length > 0) {
    console.log("Skipped:");
    for (const s of result.skipped) console.log(`  - ${s.ticker}: ${s.reason}`);
  }
}

main().catch((e) => {
  console.error("Insider history backfill failed:", e);
  process.exit(1);
});
