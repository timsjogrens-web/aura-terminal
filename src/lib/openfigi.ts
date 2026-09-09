import { db } from "./db";

// Resolves a 13F filing's CUSIP identifiers to ticker symbols via OpenFIGI's
// free public mapping API (Bloomberg's open identifier service — no key
// needed for this volume). Results are cached in the DB permanently since
// a CUSIP always maps to the same security.

const OPENFIGI_URL = "https://api.openfigi.com/v3/mapping";
const BATCH_SIZE = 100; // OpenFIGI's max per request

interface OpenFigiEntry {
  ticker?: string;
  exchCode?: string;
}
interface OpenFigiResult {
  data?: OpenFigiEntry[];
  error?: string;
}

async function resolveBatch(cusips: string[]): Promise<Map<string, string | null>> {
  const body = cusips.map((c) => ({ idType: "ID_CUSIP", idValue: c }));
  const res = await fetch(OPENFIGI_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`OpenFIGI request failed: ${res.status}`);
  const results = (await res.json()) as OpenFigiResult[];

  const map = new Map<string, string | null>();
  results.forEach((result, i) => {
    const cusip = cusips[i];
    const usMatch = result.data?.find((d) => d.exchCode === "US") ?? result.data?.[0];
    map.set(cusip, usMatch?.ticker || null);
  });
  return map;
}

export async function resolveCusipsToTickers(
  cusips: string[]
): Promise<Map<string, string | null>> {
  const unique = Array.from(new Set(cusips.filter(Boolean)));
  const result = new Map<string, string | null>();
  const uncached: string[] = [];

  for (const cusip of unique) {
    const cached = await db.execute({
      sql: "SELECT ticker FROM cusip_ticker_cache WHERE cusip = ?",
      args: [cusip],
    });
    if (cached.rows.length > 0) {
      result.set(cusip, cached.rows[0].ticker as string | null);
    } else {
      uncached.push(cusip);
    }
  }

  for (let i = 0; i < uncached.length; i += BATCH_SIZE) {
    const batch = uncached.slice(i, i + BATCH_SIZE);
    let resolved: Map<string, string | null>;
    try {
      resolved = await resolveBatch(batch);
    } catch {
      // Leave unresolved CUSIPs out rather than guessing; they'll be retried next refresh.
      continue;
    }
    for (const [cusip, ticker] of resolved) {
      result.set(cusip, ticker);
      await db.execute({
        sql: "INSERT INTO cusip_ticker_cache (cusip, ticker) VALUES (?, ?) ON CONFLICT(cusip) DO UPDATE SET ticker=excluded.ticker",
        args: [cusip, ticker],
      });
    }
    if (i + BATCH_SIZE < uncached.length) await new Promise((r) => setTimeout(r, 3000));
  }

  return result;
}
