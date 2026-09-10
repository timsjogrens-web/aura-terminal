// Fetches long monthly total-return history for the tracked universe plus
// the S&P 500 (SPY) benchmark, and caches it to disk. This is offline
// research tooling — it does not run as part of the live site.

import fs from "fs";
import path from "path";
import { getTotalReturnSeriesRaw } from "../lib/yahoo";
import { DEFAULT_UNIVERSE } from "../lib/universe";
import { getSp500Universe } from "./sp500Universe";

const CACHE_DIR = path.join(process.cwd(), "src/research/.cache");
const RANGE = "10y";
const INTERVAL = "1mo";
export const BENCHMARK_TICKER = "SPY";

// A single recently-listed ticker (e.g. ARM, IPO'd Oct 2023) shrinks the
// SHARED history window for the whole panel down to its own short history,
// since every strategy needs every ticker to have a price at every common
// month. Tickers below this bar are excluded from the research panel (with
// disclosure) rather than silently truncating 10 years of history for
// everyone else down to 3. This does NOT affect the live site's universe —
// only this offline research panel.
const MIN_HISTORY_MONTHS = 84; // 7 years

export interface MonthlySeries {
  months: string[]; // "YYYY-MM", ascending, common across every included ticker
  prices: Record<string, number[]>; // ticker -> total-return price per month (dividend-adjusted)
  fetchedAt: string;
  excludedTickers: { ticker: string; reason: string }[];
}

function toMonthKey(unixSeconds: number): string {
  const d = new Date(unixSeconds * 1000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

async function fetchOneMonthly(ticker: string): Promise<{ months: string[]; prices: number[] }> {
  const series = await getTotalReturnSeriesRaw(ticker, RANGE, INTERVAL);
  const byMonth = new Map<string, number>();
  for (let i = 0; i < series.timestamps.length; i++) {
    byMonth.set(toMonthKey(series.timestamps[i]), series.closes[i]);
  }
  const months = [...byMonth.keys()].sort();
  return { months, prices: months.map((m) => byMonth.get(m)!) };
}

export type UniverseChoice = "default" | "sp500";

function resolveUniverse(choice: UniverseChoice): { ticker: string; yahooSymbol: string }[] {
  if (choice === "sp500") {
    return getSp500Universe().map((e) => ({ ticker: e.ticker, yahooSymbol: e.yahooSymbol }));
  }
  return DEFAULT_UNIVERSE.map((e) => ({ ticker: e.ticker, yahooSymbol: e.ticker }));
}

export async function fetchUniverseMonthlyHistory(opts?: {
  useCache?: boolean;
  universe?: UniverseChoice;
}): Promise<MonthlySeries> {
  const useCache = opts?.useCache ?? true;
  const universeChoice = opts?.universe ?? "default";
  const cachePath = path.join(CACHE_DIR, `monthly-history.${universeChoice}.json`);

  if (useCache && fs.existsSync(cachePath)) {
    return JSON.parse(fs.readFileSync(cachePath, "utf8"));
  }

  const entries = [...resolveUniverse(universeChoice), { ticker: BENCHMARK_TICKER, yahooSymbol: BENCHMARK_TICKER }];
  const perTicker: Record<string, { months: string[]; prices: number[] }> = {};
  const excludedTickers: { ticker: string; reason: string }[] = [];

  for (const entry of entries) {
    try {
      const data = await fetchOneMonthly(entry.yahooSymbol);
      if (entry.ticker !== BENCHMARK_TICKER && data.months.length < MIN_HISTORY_MONTHS) {
        console.error(
          `EXCLUDED ${entry.ticker}: only ${data.months.length} months of history (< ${MIN_HISTORY_MONTHS} required) — likely a recent IPO/listing`
        );
        excludedTickers.push({
          ticker: entry.ticker,
          reason: `only ${data.months.length} months of history available (recent listing)`,
        });
        continue;
      }
      perTicker[entry.ticker] = data;
      console.error(`fetched ${entry.ticker}: ${data.months.length} months`);
    } catch (e) {
      console.error(`EXCLUDED ${entry.ticker}: ${(e as Error).message}`);
      excludedTickers.push({ ticker: entry.ticker, reason: (e as Error).message });
    }
    await new Promise((r) => setTimeout(r, 150)); // stay polite to Yahoo's free, unauthenticated endpoint
  }

  const okTickers = Object.keys(perTicker);
  if (okTickers.length === 0) throw new Error("Failed to fetch history for every ticker.");

  // Intersect months across every successfully-fetched ticker so the panel
  // has no ragged edges — a strategy loop can then assume every ticker has
  // a price at every month index.
  const monthSets = okTickers.map((t) => new Set(perTicker[t].months));
  const commonMonths = perTicker[okTickers[0]].months.filter((m) => monthSets.every((s) => s.has(m)));

  const prices: Record<string, number[]> = {};
  for (const t of okTickers) {
    const idx = new Map(perTicker[t].months.map((m, i) => [m, i]));
    prices[t] = commonMonths.map((m) => perTicker[t].prices[idx.get(m)!]);
  }

  const result: MonthlySeries = {
    months: commonMonths,
    prices,
    fetchedAt: new Date().toISOString(),
    excludedTickers,
  };

  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(cachePath, JSON.stringify(result));
  return result;
}
