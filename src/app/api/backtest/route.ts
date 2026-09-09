import { NextRequest, NextResponse } from "next/server";
import { runBacktest } from "@/lib/backtest";
import { DEFAULT_WEIGHTS } from "@/lib/scoring";
import { YahooError } from "@/lib/yahoo";
import { UNIVERSE_MAP } from "@/lib/universe";

function clampWeight(raw: string | null, fallback: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.min(n, 100);
}

export async function GET(req: NextRequest) {
  const ticker = (req.nextUrl.searchParams.get("ticker") ?? "").toUpperCase();
  if (!UNIVERSE_MAP.has(ticker)) {
    return NextResponse.json({ error: "Unknown ticker. Pick one from the tracked universe." }, { status: 400 });
  }

  const range = req.nextUrl.searchParams.get("range") ?? "1Y";
  const weights = {
    trend: clampWeight(req.nextUrl.searchParams.get("trend"), DEFAULT_WEIGHTS.trend),
    momentum: clampWeight(req.nextUrl.searchParams.get("momentum"), DEFAULT_WEIGHTS.momentum),
    volume: clampWeight(req.nextUrl.searchParams.get("volume"), DEFAULT_WEIGHTS.volume),
  };
  if (weights.trend + weights.momentum + weights.volume === 0) {
    return NextResponse.json({ error: "At least one weight must be greater than zero." }, { status: 400 });
  }

  try {
    const result = await runBacktest(ticker, weights, range);
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof YahooError ? e.message : "Backtest failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
