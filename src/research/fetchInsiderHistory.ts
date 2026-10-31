// Backfills years of historical SEC Form 4 (insider trading) filings for
// the CORE_UNIVERSE — the live site's insider page only ever fetches
// *recent* filings (see src/lib/secForm4.ts's getRecentInsiderTransactions),
// so testing an insider-buying factor against the same locked research
// window used for the price-based strategies needs its own, much deeper
// pull. Offline research tooling only — does not run as part of the live
// site, and never touches the live insider_trades table.
//
// Run with: npx tsx src/research/fetchInsiderHistory.ts

import fs from "fs";
import path from "path";
import { CORE_UNIVERSE } from "../lib/universe";
import { getCikForTicker, getForm4FilingsSince, parseForm4Doc, InsiderTransaction } from "../lib/secForm4";

const CACHE_DIR = path.join(process.cwd(), "src/research/.cache");
const CACHE_PATH = path.join(CACHE_DIR, "insider-history.json");

// Covers the full ~7-10 year research window (see fetchHistory.ts's
// MIN_HISTORY_MONTHS) with margin — a filing from before this is outside
// every strategy's lookback anyway.
const SINCE_DATE = "2015-01-01";
const MAX_FILINGS_PER_TICKER = 400;

export interface InsiderHistory {
  fetchedAt: string;
  byTicker: Record<string, InsiderTransaction[]>;
  skipped: { ticker: string; reason: string }[];
}

async function fetchOneTicker(ticker: string): Promise<InsiderTransaction[]> {
  const cik = await getCikForTicker(ticker);
  if (!cik) throw new Error(`No CIK found for ${ticker}`);

  const filings = await getForm4FilingsSince(cik, SINCE_DATE, MAX_FILINGS_PER_TICKER);
  const out: InsiderTransaction[] = [];
  for (const filing of filings) {
    try {
      const txns = await parseForm4Doc(filing.indexUrl, ticker, filing.filingDate);
      out.push(...txns);
    } catch {
      continue; // one malformed/unusual filing shouldn't block the rest
    }
    await new Promise((r) => setTimeout(r, 150)); // stay well under SEC's fair-access rate limit
  }
  return out;
}

export async function fetchInsiderHistory(opts?: { useCache?: boolean }): Promise<InsiderHistory> {
  const useCache = opts?.useCache ?? true;
  if (useCache && fs.existsSync(CACHE_PATH)) {
    return JSON.parse(fs.readFileSync(CACHE_PATH, "utf8"));
  }

  const byTicker: Record<string, InsiderTransaction[]> = {};
  const skipped: { ticker: string; reason: string }[] = [];

  for (const entry of CORE_UNIVERSE) {
    try {
      const txns = await fetchOneTicker(entry.ticker);
      byTicker[entry.ticker] = txns;
      console.error(`fetched ${entry.ticker}: ${txns.length} P/S transactions`);
    } catch (e) {
      console.error(`SKIPPED ${entry.ticker}: ${(e as Error).message}`);
      skipped.push({ ticker: entry.ticker, reason: (e as Error).message });
    }
  }

  const result: InsiderHistory = { fetchedAt: new Date().toISOString(), byTicker, skipped };
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(CACHE_PATH, JSON.stringify(result));
  return result;
}

function loadCache(): InsiderHistory | null {
  if (!fs.existsSync(CACHE_PATH)) return null;
  try {
    return JSON.parse(fs.readFileSync(CACHE_PATH, "utf8"));
  } catch {
    return null; // corrupt/partial file from an interrupted write — start fresh
  }
}

function saveCache(result: InsiderHistory) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(CACHE_PATH, JSON.stringify(result));
}

// Resumable variant for the CLI backfill (runInsiderBackfill.ts). A
// multi-thousand-request crawl against a third party is exactly the kind
// of run a dropped connection or a sleeping laptop can interrupt partway
// through — this skips tickers already fetched successfully, retries only
// the ones that previously failed (or were never attempted), and writes
// the merged cache to disk after EVERY ticker instead of once at the very
// end, so a future interruption only ever loses the one ticker in flight.
export async function backfillInsiderHistory(): Promise<InsiderHistory> {
  const existing = loadCache();
  const byTicker: Record<string, InsiderTransaction[]> = { ...(existing?.byTicker ?? {}) };
  let skipped: { ticker: string; reason: string }[] = existing?.skipped ?? [];

  const alreadyDone = new Set(Object.keys(byTicker));
  const toFetch = CORE_UNIVERSE.filter((e) => !alreadyDone.has(e.ticker));

  if (alreadyDone.size > 0) {
    console.error(`Resuming: ${alreadyDone.size} tickers already fetched, ${toFetch.length} remaining.\n`);
  }

  for (const entry of toFetch) {
    try {
      const txns = await fetchOneTicker(entry.ticker);
      byTicker[entry.ticker] = txns;
      skipped = skipped.filter((s) => s.ticker !== entry.ticker);
      console.error(`fetched ${entry.ticker}: ${txns.length} P/S transactions`);
    } catch (e) {
      console.error(`SKIPPED ${entry.ticker}: ${(e as Error).message}`);
      skipped = [...skipped.filter((s) => s.ticker !== entry.ticker), { ticker: entry.ticker, reason: (e as Error).message }];
    }
    // Saved after every ticker, success or failure — the whole point of
    // this resumable variant over fetchInsiderHistory's one-shot version.
    saveCache({ fetchedAt: new Date().toISOString(), byTicker, skipped });
  }

  return { fetchedAt: new Date().toISOString(), byTicker, skipped };
}
