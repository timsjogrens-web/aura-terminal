import { NextResponse } from "next/server";
import { db, getMeta } from "@/lib/db";

const STALE_MS = 20 * 60 * 1000;

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

export async function GET() {
  const rows = db
    .prepare("SELECT * FROM quote_cache ORDER BY score DESC NULLS LAST")
    .all() as QuoteRow[];

  const lastRefresh = getMeta("last_refresh_at");
  const now = Date.now();
  const isStale = lastRefresh
    ? now - new Date(lastRefresh).getTime() > STALE_MS
    : true;

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
