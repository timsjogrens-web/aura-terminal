// Daily OHLCV history for the FULL live-trading universe (DEFAULT_UNIVERSE,
// 167 tickers — the paper bot trades across all of it, not just the 41-
// ticker CORE_UNIVERSE the strategy research above uses), for simulating
// the paper bot's actual entry/exit mechanics (see simulatePaperBot.ts).
// Offline research tooling only — does not run as part of the live site.

import fs from "fs";
import path from "path";
import { getDailyCandles, DailyCandles } from "../lib/yahoo";
import { DEFAULT_UNIVERSE } from "../lib/universe";

const CACHE_DIR = path.join(process.cwd(), "src/research/.cache");
const CACHE_PATH = path.join(CACHE_DIR, "daily-history.json");
const RANGE = "2y"; // matches backtest.ts's LOOKBACK_RANGE

export interface DailyHistory {
  fetchedAt: string;
  byTicker: Record<string, DailyCandles>;
  excludedTickers: { ticker: string; reason: string }[];
}

export async function fetchDailyHistory(opts?: { useCache?: boolean }): Promise<DailyHistory> {
  const useCache = opts?.useCache ?? true;
  if (useCache && fs.existsSync(CACHE_PATH)) {
    return JSON.parse(fs.readFileSync(CACHE_PATH, "utf8"));
  }

  const byTicker: Record<string, DailyCandles> = {};
  const excludedTickers: { ticker: string; reason: string }[] = [];

  for (const entry of DEFAULT_UNIVERSE) {
    try {
      const candles = await getDailyCandles(entry.ticker, RANGE);
      if (candles.adjCloses.length < 60) {
        excludedTickers.push({ ticker: entry.ticker, reason: `only ${candles.adjCloses.length} days of history` });
        continue;
      }
      byTicker[entry.ticker] = candles;
      console.error(`fetched ${entry.ticker}: ${candles.adjCloses.length} days`);
    } catch (e) {
      console.error(`EXCLUDED ${entry.ticker}: ${(e as Error).message}`);
      excludedTickers.push({ ticker: entry.ticker, reason: (e as Error).message });
    }
    await new Promise((r) => setTimeout(r, 150)); // stay polite to Yahoo's free, unauthenticated endpoint
  }

  const result: DailyHistory = { fetchedAt: new Date().toISOString(), byTicker, excludedTickers };
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(CACHE_PATH, JSON.stringify(result));
  return result;
}
