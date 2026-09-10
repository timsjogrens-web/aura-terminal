import { NextResponse } from "next/server";
import { getMeta, setMeta } from "@/lib/db";
import { computeUniverseTrackRecord } from "@/lib/trackRecord";

// Fetching ~40 tickers' full 2-year history and re-running the simulation
// on every page view would be slow and hammer Yahoo's free endpoint for
// no reason — the underlying signals only change once a day at most, so a
// several-hour cache is plenty fresh without being stale in any way that
// matters here.
const CACHE_KEY = "track_record_cache_v1";
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

export async function GET() {
  const cachedRaw = await getMeta(CACHE_KEY);
  if (cachedRaw) {
    const cached = JSON.parse(cachedRaw);
    if (Date.now() - new Date(cached.generatedAt).getTime() < CACHE_TTL_MS) {
      return NextResponse.json(cached);
    }
  }

  const result = await computeUniverseTrackRecord();
  const payload = { ...result, generatedAt: new Date().toISOString() };
  await setMeta(CACHE_KEY, JSON.stringify(payload));
  return NextResponse.json(payload);
}
