import { NextResponse, after } from "next/server";
import { db, getMeta, setMeta } from "@/lib/db";
import { refreshAll } from "@/lib/refresh";

const STALE_MS = 20 * 60 * 1000;
const LOCK_MS = 5 * 60 * 1000; // a refresh should never take this long; treat a stuck lock as stale

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
  updated_at: string | null;
  error: string | null;
}

async function selfHealRefresh() {
  const lock = await getMeta("refresh_lock_at");
  if (lock && Date.now() - new Date(lock).getTime() < LOCK_MS) return; // another invocation already refreshing

  await setMeta("refresh_lock_at", new Date().toISOString());
  try {
    await refreshAll();
  } catch (e) {
    console.error("[aura] self-heal refresh failed:", e);
  } finally {
    await setMeta("refresh_lock_at", "");
  }
}

export async function GET() {
  const res = await db.execute("SELECT * FROM quote_cache ORDER BY score DESC NULLS LAST");
  const rows = res.rows as unknown as QuoteRow[];

  const lastRefresh = await getMeta("last_refresh_at");
  const now = Date.now();
  const isStale = lastRefresh ? now - new Date(lastRefresh).getTime() > STALE_MS : true;

  // Self-heal: on a serverless host, cron may be delayed or unsupported on
  // the free plan, so a stale cache kicks off a background refresh here too
  // rather than depending on the scheduler alone. `after` keeps this work
  // alive past the response instead of racing the function's teardown.
  if (isStale && process.env.FINNHUB_API_KEY) {
    after(selfHealRefresh);
  }

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
