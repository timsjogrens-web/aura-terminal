import { NextResponse, after } from "next/server";
import { db, getMeta } from "@/lib/db";
import { refreshAll, loadTargets } from "@/lib/refresh";

// A refresh is triggered once any tracked stock's data is older than this.
// It refreshes a slice of the stalest stocks (see refreshAll), so with a
// tab open the whole universe keeps cycling well inside this window.
const STALE_MS = 20 * 60 * 1000;

// after() keeps the background refresh alive past the response, but only
// up to the function's max duration — the default is too short for a batch.
export const maxDuration = 60;

interface QuoteRow {
  ticker: string;
  company_name: string | null;
  sector: string | null;
  price: number | null;
  change: number | null;
  change_pct: number | null;
  open: number | null;
  high: number | null;
  low: number | null;
  prev_close: number | null;
  volume: number | null;
  avg_volume: number | null;
  sma50: number | null;
  rsi14: number | null;
  score: number | null;
  signal: string | null;
  sparkline: string | null;
  next_earnings: string | null;
  news: string | null;
  logo: string | null;
  updated_at: string | null;
  error: string | null;
}

export async function GET() {
  const res = await db.execute("SELECT * FROM quote_cache ORDER BY score DESC NULLS LAST");
  const rows = res.rows as unknown as QuoteRow[];

  const lastRefresh = await getMeta("last_refresh_at");
  const now = Date.now();

  // Staleness is judged on the stalest CURRENT target (not on when the last
  // batch finished — a batch only covers part of the universe), and a stock
  // that has never been fetched counts as stale too. Rows left over from
  // removed watchlist entries are ignored, or they'd keep this true forever.
  const targets = await loadTargets();
  const rowByTicker = new Map(rows.map((r) => [r.ticker, r]));
  const anyMissing = targets.some((t) => !rowByTicker.has(t.ticker));
  let oldestMs = Infinity;
  for (const t of targets) {
    const r = rowByTicker.get(t.ticker);
    if (r) oldestMs = Math.min(oldestMs, r.updated_at ? new Date(r.updated_at).getTime() : 0);
  }
  const needsRefresh = anyMissing || !Number.isFinite(oldestMs) || now - oldestMs > STALE_MS;

  // Self-heal: on a serverless host, cron may be delayed or unsupported on
  // the free plan, so stale data kicks off a background refresh here too
  // rather than depending on the scheduler alone. refreshAll takes its own
  // lock, so overlapping calls from repeated polls are harmless.
  if (needsRefresh && process.env.FINNHUB_API_KEY) {
    after(() =>
      refreshAll().catch((e) => {
        console.error("[aura] self-heal refresh failed:", e);
      })
    );
  }

  // The banner only calls data "delayed" when it's clearly behind, not just
  // while the next slice is about to run.
  const isStale = !Number.isFinite(oldestMs) || now - oldestMs > STALE_MS * 2;

  const quotes = rows.map((r) => ({
    ...r,
    sparkline: r.sparkline ? (JSON.parse(r.sparkline) as number[]) : [],
    news: r.news ? JSON.parse(r.news) : [],
  }));

  return NextResponse.json({
    quotes,
    lastRefresh,
    isStale,
    staleThresholdMinutes: STALE_MS / 60000,
    apiKeyConfigured: Boolean(process.env.FINNHUB_API_KEY),
  });
}
