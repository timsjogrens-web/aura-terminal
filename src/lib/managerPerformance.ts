import { db, getMeta, setMeta } from "./db";
import { MANAGERS } from "./investors";
import { getChartSeries } from "./yahoo";
import { getPaperPortfolioState, STARTING_CASH } from "./paperTrading";

// 13F filings never disclose a cost basis, so there's no honest way to
// compute "Buffett's actual return." What IS real and computable: the
// price performance of each manager's disclosed holdings from their
// filing date to today, weighted by position size. That's what this
// measures — not their real trading return, which no public data source
// can produce. Coverage % (how much of the filed portfolio value has a
// resolved ticker to price) is carried alongside every entry so a thin
// coverage number is visible rather than hidden.
const MAX_HOLDINGS_PRICED = 10;
const CACHE_KEY = "leaderboard_cache";
const CACHE_TTL_MS = 60 * 60 * 1000;

interface HoldingRow {
  ticker: string | null;
  value: number;
}

function pickRange(sinceDate: string): string {
  const days = (Date.now() - new Date(sinceDate).getTime()) / 86_400_000;
  if (days <= 5) return "1W";
  if (days <= 25) return "1M";
  if (days <= 80) return "3M";
  if (days <= 170) return "6M";
  if (days <= 350) return "1Y";
  if (days <= 1000) return "3Y";
  return "5Y";
}

async function getTickerReturnSince(
  ticker: string,
  sinceDate: string,
  cache: Map<string, number | null>
): Promise<number | null> {
  const key = `${ticker}|${sinceDate}`;
  if (cache.has(key)) return cache.get(key)!;
  try {
    const series = await getChartSeries(ticker, pickRange(sinceDate));
    const startMs = new Date(sinceDate).getTime();
    let entryIdx = 0;
    for (let i = 0; i < series.timestamps.length; i++) {
      if (series.timestamps[i] * 1000 >= startMs) {
        entryIdx = i;
        break;
      }
      entryIdx = i;
    }
    const entryPrice = series.closes[entryIdx];
    const currentPrice = series.closes[series.closes.length - 1];
    const returnPct = ((currentPrice - entryPrice) / entryPrice) * 100;
    cache.set(key, returnPct);
    return returnPct;
  } catch {
    cache.set(key, null);
    return null;
  }
}

export interface LeaderboardEntry {
  slug: string;
  name: string;
  fund: string;
  isAura: boolean;
  returnPct: number | null;
  coveragePct: number | null;
  asOfDate: string | null;
}

async function getAuraEntry(): Promise<LeaderboardEntry> {
  const state = await getPaperPortfolioState();
  const tickers = state.openPositions.map((p) => p.ticker);
  let priceByTicker = new Map<string, number>();
  if (tickers.length > 0) {
    const placeholders = tickers.map(() => "?").join(",");
    const res = await db.execute({
      sql: `SELECT ticker, price FROM quote_cache WHERE ticker IN (${placeholders})`,
      args: tickers,
    });
    priceByTicker = new Map(
      (res.rows as unknown as { ticker: string; price: number | null }[]).map((r) => [r.ticker, Number(r.price ?? 0)])
    );
  }
  const holdingsValue = state.openPositions.reduce(
    (a, p) => a + p.shares * (priceByTicker.get(p.ticker) ?? p.entryPrice),
    0
  );
  const totalValue = state.cash + holdingsValue;
  return {
    slug: "aura",
    name: "Aura Signal Engine",
    fund: "This app's own paper portfolio",
    isAura: true,
    returnPct: state.startedAt ? ((totalValue - STARTING_CASH) / STARTING_CASH) * 100 : null,
    coveragePct: 100,
    asOfDate: state.startedAt,
  };
}

async function computeFresh(): Promise<LeaderboardEntry[]> {
  const priceCache = new Map<string, number | null>();
  const entries: LeaderboardEntry[] = [];

  for (const m of MANAGERS) {
    const datesRes = await db.execute({
      sql: "SELECT DISTINCT filing_date FROM institutional_holdings WHERE manager_slug = ? ORDER BY filing_date DESC LIMIT 1",
      args: [m.slug],
    });
    const filingDate = (datesRes.rows[0] as { filing_date: string } | undefined)?.filing_date ?? null;
    if (!filingDate) {
      entries.push({ slug: m.slug, name: m.name, fund: m.fund, isAura: false, returnPct: null, coveragePct: null, asOfDate: null });
      continue;
    }

    const holdingsRes = await db.execute({
      sql: "SELECT ticker, value FROM institutional_holdings WHERE manager_slug = ? AND filing_date = ? ORDER BY value DESC",
      args: [m.slug, filingDate],
    });
    const holdings = holdingsRes.rows as unknown as HoldingRow[];
    const totalValue = holdings.reduce((a, h) => a + Number(h.value), 0);
    const resolved = holdings.filter((h) => h.ticker).slice(0, MAX_HOLDINGS_PRICED);

    let weightedReturnSum = 0;
    let coveredValue = 0;
    for (const h of resolved) {
      const r = await getTickerReturnSince(h.ticker as string, filingDate, priceCache);
      if (r === null) continue;
      weightedReturnSum += r * Number(h.value);
      coveredValue += Number(h.value);
    }

    entries.push({
      slug: m.slug,
      name: m.name,
      fund: m.fund,
      isAura: false,
      returnPct: coveredValue > 0 ? weightedReturnSum / coveredValue : null,
      coveragePct: totalValue > 0 ? (coveredValue / totalValue) * 100 : null,
      asOfDate: filingDate,
    });
  }

  entries.push(await getAuraEntry());
  return entries;
}

export async function getLeaderboard(): Promise<{ entries: LeaderboardEntry[]; cachedAt: string }> {
  const cachedRaw = await getMeta(CACHE_KEY);
  if (cachedRaw) {
    const cached = JSON.parse(cachedRaw) as { entries: LeaderboardEntry[]; cachedAt: string };
    if (Date.now() - new Date(cached.cachedAt).getTime() < CACHE_TTL_MS) {
      return cached;
    }
  }
  const entries = await computeFresh();
  const result = { entries, cachedAt: new Date().toISOString() };
  await setMeta(CACHE_KEY, JSON.stringify(result));
  return result;
}
