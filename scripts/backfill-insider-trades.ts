// One-time backfill of the live `insider_trades` table from the deep
// historical SEC Form 4 pull already done for research (see
// src/research/fetchInsiderHistory.ts and its cache at
// src/research/.cache/insider-history.json, ~21,400 transactions back to
// 2015). Without this, the live "insider cluster-buying" indicator on the
// stock page would only have whatever refreshInsiders.ts has trickled in
// from its last-8-filings-per-refresh pulls — nowhere near enough for a
// meaningful trailing-90-day window on day one.
//
// Safe to re-run: same INSERT OR IGNORE + unique index
// (ticker, owner_name, transaction_date, shares, price) that
// refreshInsiders.ts already relies on, so this can never create
// duplicates even if run against a table that already has some overlap.
//
// Usage: npx tsx scripts/backfill-insider-trades.ts

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env.local into process.env before anything touches src/lib/db.ts,
// same minimal parser the other scripts/*.mjs migrations use.
const envPath = path.join(__dirname, "..", ".env.local");
const envText = readFileSync(envPath, "utf8");
for (const line of envText.split("\n")) {
  const match = line.match(/^([A-Z_]+)=(.*)$/);
  if (match && !process.env[match[1]]) {
    process.env[match[1]] = match[2].replace(/^"(.*)"$/, "$1");
  }
}

async function main() {
  const { db } = await import("../src/lib/db");
  const cachePath = path.join(__dirname, "..", "src/research/.cache/insider-history.json");
  const history = JSON.parse(readFileSync(cachePath, "utf8")) as {
    byTicker: Record<
      string,
      { ticker: string; ownerName: string; ownerTitle: string | null; transactionCode: string; shares: number; price: number; transactionDate: string; filingDate: string }[]
    >;
  };

  const INSERT_SQL = `
    INSERT OR IGNORE INTO insider_trades
      (ticker, owner_name, owner_title, transaction_code, shares, price, value, transaction_date, filing_date, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const now = new Date().toISOString();
  const flat = Object.entries(history.byTicker).flatMap(([ticker, txns]) => txns.map((t) => ({ ticker, t })));

  // Every row is an independent INSERT OR IGNORE with no ordering
  // dependency on any other, so a small concurrency window is safe here
  // (unlike the SEC crawl, this is our own DB, not a third party with a
  // fair-access policy to respect) — turns a ~21k-request sequential run
  // into a few hundred batches instead. Each row gets its own retry and
  // its own try/catch (not a bare Promise.all) — the SEC backfill script
  // already taught us that one transient failure inside a batch otherwise
  // takes the ENTIRE run down with it, with nothing written.
  async function insertOneWithRetry(ticker: string, t: (typeof flat)[number]["t"], attempts = 3): Promise<boolean> {
    for (let i = 0; i < attempts; i++) {
      try {
        await db.execute({
          sql: INSERT_SQL,
          args: [
            ticker,
            t.ownerName,
            t.ownerTitle,
            t.transactionCode,
            t.shares,
            t.price,
            t.shares * t.price,
            t.transactionDate,
            t.filingDate,
            now,
          ],
        });
        return true;
      } catch (e) {
        if (i === attempts - 1) {
          console.error(`FAILED ${ticker} ${t.transactionDate} ${t.ownerName}: ${(e as Error).message}`);
          return false;
        }
        await new Promise((r) => setTimeout(r, 500 * 2 ** i));
      }
    }
    return false;
  }

  const CONCURRENCY = 20;
  let done = 0;
  let failed = 0;
  for (let i = 0; i < flat.length; i += CONCURRENCY) {
    const chunk = flat.slice(i, i + CONCURRENCY);
    const results = await Promise.all(chunk.map(({ ticker, t }) => insertOneWithRetry(ticker, t)));
    failed += results.filter((ok) => !ok).length;
    done += chunk.length;
    if (done % 2000 < CONCURRENCY) console.log(`${done}/${flat.length} transactions processed...`);
  }

  console.log(
    `\nDone. ${flat.length} transactions attempted as INSERT OR IGNORE (rows that already existed were silently skipped by the unique index, not duplicated). ${failed} failed after retries — safe to just re-run this script, since every row is idempotent.`
  );
}

main().catch((e) => {
  console.error("Backfill failed:", e);
  process.exit(1);
});
