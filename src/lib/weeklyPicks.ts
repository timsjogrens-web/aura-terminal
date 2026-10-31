import { db } from "./db";

export interface WeeklyPick {
  ticker: string;
  companyName: string | null;
  price: number | null;
  logo: string | null;
  signal: string;
  score: number | null;
  signaledAt: string;
}

const WINDOW_DAYS = 7;
const LIMIT = 5;

// A small, stable shortlist instead of "every current BUY/STRONG BUY
// signal" (which can be 20-30+ tickers at once — fine for the auto-bot,
// which never gets tired, but not something a person can realistically
// buy all of with their own money without an unreasonable number of
// trades). Picks the tickers whose most recent move INTO buy territory
// happened within the last week and that are STILL there now (excludes
// anything that's already reversed), ranked by the score at the moment
// each one qualified — not the live score, which drifts every refresh
// and would make this list flicker instead of holding steady for the
// week the name on it implies.
export async function getWeeklyTopPicks(): Promise<WeeklyPick[]> {
  const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const res = await db.execute({
    sql: `
      SELECT q.ticker, q.company_name, q.price, q.logo, q.signal, h.score, h.timestamp
      FROM quote_cache q
      JOIN signal_history h ON h.ticker = q.ticker
      WHERE h.timestamp >= ?
        AND h.signal IN ('STRONG BUY', 'BUY')
        AND q.signal IN ('STRONG BUY', 'BUY')
        AND h.timestamp = (
          SELECT MAX(h2.timestamp) FROM signal_history h2
          WHERE h2.ticker = h.ticker AND h2.timestamp >= ?
        )
      ORDER BY h.score DESC
      LIMIT ?
    `,
    args: [since, since, LIMIT],
  });

  return (
    res.rows as unknown as {
      ticker: string;
      company_name: string | null;
      price: number | null;
      logo: string | null;
      signal: string;
      score: number | null;
      timestamp: string;
    }[]
  ).map((r) => ({
    ticker: r.ticker,
    companyName: r.company_name,
    price: r.price,
    logo: r.logo,
    signal: r.signal,
    score: r.score,
    signaledAt: r.timestamp,
  }));
}
