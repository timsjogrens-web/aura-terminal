import { NextResponse } from "next/server";
import { getMeta, setMeta } from "@/lib/db";
import { computeUniverseTrackRecord } from "@/lib/trackRecord";

// Fetching every tracked ticker's full 2-year history and re-running the simulation
// on every page view would be slow and hammer Yahoo's free endpoint for
// no reason — the underlying signals only change once a day at most, so a
// several-hour cache is plenty fresh without being stale in any way that
// matters here.
// v2: the tracked universe grew from ~40 to ~170 stocks, so older cached
// results describe a different portfolio and must not be served.
// v3: the bot's entry rule changed from BUY-or-STRONG-BUY to STRONG BUY
// only (see paperTrading.ts's maybeTrade) — a v2-cached result used the
// old rule and must not be served under the new methodology's numbers.
const CACHE_KEY = "track_record_cache_v3";
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

// Fetching that history (a few tickers at a time) still takes a while
// depending on network conditions to Yahoo, which can exceed Vercel's
// default serverless timeout — this raises the ceiling for this one route rather than
// risking a cold-cache request getting killed mid-computation.
export const maxDuration = 60;

export async function GET() {
  const cachedRaw = await getMeta(CACHE_KEY);
  const cached = cachedRaw ? JSON.parse(cachedRaw) : null;
  if (cached && Date.now() - new Date(cached.generatedAt).getTime() < CACHE_TTL_MS) {
    return NextResponse.json(cached);
  }

  try {
    const result = await computeUniverseTrackRecord();
    const payload = { ...result, generatedAt: new Date().toISOString() };
    await setMeta(CACHE_KEY, JSON.stringify(payload));
    return NextResponse.json(payload);
  } catch (e) {
    // A fresh computation failing (e.g. Yahoo hiccup) shouldn't take the
    // page down if we have something, even a stale something, to show
    // instead — better an honestly-dated older result than a hard error.
    if (cached) return NextResponse.json(cached);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Kunde inte beräkna track record." },
      { status: 500 }
    );
  }
}
