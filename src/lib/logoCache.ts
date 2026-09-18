import { db } from "./db";
import { getProfile } from "./finnhub";

// A ticker->logo cache for ANY symbol, not just the site's tracked
// universe — used for institutional-holdings pages, where a fund manager's
// disclosed positions are mostly names Aura doesn't otherwise track. Kept
// in its own table rather than reusing quote_cache: quote_cache backs the
// Markets screener (`SELECT * FROM quote_cache`), so inserting a logo-only
// row for some arbitrary 13F holding would show up there as a broken,
// price-less quote row. Logos don't change, so once fetched a ticker is
// never re-requested from Finnhub.
const CACHE_SQL = `SELECT ticker, logo FROM ticker_logo_cache WHERE ticker IN`;

export async function getLogosForTickers(tickers: string[]): Promise<Map<string, string | null>> {
  const unique = Array.from(new Set(tickers.filter(Boolean)));
  if (unique.length === 0) return new Map();

  const placeholders = unique.map(() => "?").join(",");
  const cachedRes = await db.execute({
    sql: `${CACHE_SQL} (${placeholders})`,
    args: unique,
  });
  const cached = new Map(
    (cachedRes.rows as unknown as { ticker: string; logo: string | null }[]).map((r) => [r.ticker, r.logo])
  );

  const missing = unique.filter((t) => !cached.has(t));
  if (missing.length === 0) return cached;

  // Modest concurrency cap rather than one large parallel burst or a fully
  // sequential fetch — a manager's holdings list can run 30-50+ tickers
  // and this runs on-demand when a visitor opens the page, so it needs to
  // stay reasonably fast without hammering Finnhub's free-tier rate limit.
  const CONCURRENCY = 6;
  const now = new Date().toISOString();
  for (let i = 0; i < missing.length; i += CONCURRENCY) {
    const batch = missing.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      batch.map(async (ticker) => {
        try {
          const profile = await getProfile(ticker);
          return { ticker, logo: profile.logo || null };
        } catch {
          return { ticker, logo: null }; // cache the miss too, so a delisted/unknown ticker isn't re-requested every page view
        }
      })
    );
    for (const r of results) {
      cached.set(r.ticker, r.logo);
      await db.execute({
        sql: `INSERT INTO ticker_logo_cache (ticker, logo, cached_at) VALUES (?, ?, ?)
              ON CONFLICT(ticker) DO UPDATE SET logo=excluded.logo, cached_at=excluded.cached_at`,
        args: [r.ticker, r.logo, now],
      });
    }
  }

  return cached;
}
