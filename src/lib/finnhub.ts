const BASE_URL = "https://finnhub.io/api/v1";

export class FinnhubError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "FinnhubError";
    this.status = status;
  }
}

function getKey(): string {
  const key = process.env.FINNHUB_API_KEY;
  if (!key) {
    throw new FinnhubError(
      "FINNHUB_API_KEY is not set. Add it to .env.local to enable live data."
    );
  }
  return key;
}

async function finnhubGet<T>(pathname: string, params: Record<string, string>): Promise<T> {
  const key = getKey();
  const url = new URL(BASE_URL + pathname);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("token", key);

  let res: Response;
  try {
    res = await fetch(url.toString(), { cache: "no-store" });
  } catch (e) {
    throw new FinnhubError(
      `Network error contacting Finnhub: ${(e as Error).message}`
    );
  }

  if (res.status === 429) {
    throw new FinnhubError("Finnhub rate limit hit (429). Try again shortly.", 429);
  }
  if (!res.ok) {
    throw new FinnhubError(`Finnhub API error: ${res.status} ${res.statusText}`, res.status);
  }
  return (await res.json()) as T;
}

export interface FinnhubQuote {
  c: number; // current price
  d: number; // change
  dp: number; // percent change
  h: number; // high
  l: number; // low
  o: number; // open
  pc: number; // previous close
  t: number; // timestamp
}

export async function getQuote(symbol: string): Promise<FinnhubQuote> {
  const q = await finnhubGet<FinnhubQuote>("/quote", { symbol });
  if (q.c === 0 && q.pc === 0) {
    throw new FinnhubError(`No quote data returned for ${symbol}`);
  }
  return q;
}

export interface FinnhubProfile {
  name?: string;
  finnhubIndustry?: string;
}

export async function getProfile(symbol: string): Promise<FinnhubProfile> {
  return finnhubGet<FinnhubProfile>("/stock/profile2", { symbol });
}

export interface FinnhubEarningsEntry {
  symbol: string;
  date: string;
  epsEstimate?: number | null;
  hour?: string;
}

export async function getEarningsCalendar(
  symbol: string,
  fromDate: string,
  toDate: string
): Promise<FinnhubEarningsEntry[]> {
  const res = await finnhubGet<{ earningsCalendar: FinnhubEarningsEntry[] }>(
    "/calendar/earnings",
    { symbol, from: fromDate, to: toDate }
  );
  return res.earningsCalendar ?? [];
}

export interface FinnhubSearchResult {
  count: number;
  result: Array<{ symbol: string; description: string; type: string }>;
}

export async function searchSymbol(query: string): Promise<FinnhubSearchResult> {
  return finnhubGet<FinnhubSearchResult>("/search", { q: query });
}
