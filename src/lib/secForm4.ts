// Officer/director/10%-owner trading disclosures (SEC Form 4) — same
// free, public EDGAR data source as the 13F client, just a different
// filing type and scoped to individual companies instead of fund managers.

// SEC's fair-access policy (https://www.sec.gov/os/webmaster-faq#developers)
// requires a real, reachable contact in the User-Agent — the previous
// "contact@candor.example" used the reserved .example TLD, which can't
// actually receive mail. That's exactly the kind of non-compliant header
// SEC's automated traffic filtering is liable to start throttling or
// blocking under sustained volume, which is what a multi-thousand-request
// research backfill ran straight into (see src/research/fetchInsiderHistory.ts).
const SEC_USER_AGENT = "Candor (personal finance dashboard) timsjogrens.jobb@gmail.com";
const TICKERS_JSON_URL = "https://www.sec.gov/files/company_tickers.json";

export class Form4Error extends Error {}

// A transient blip (a dropped connection, a momentary 429/503 from EDGAR)
// used to take down the entire research backfill permanently — one failed
// fetch partway through a multi-thousand-request run threw, and nothing
// above caught it. A short, bounded retry absorbs exactly that kind of
// one-off without masking a genuinely broken ticker/URL (those still fail
// for good after `attempts` tries).
async function secFetch(url: string, attempts = 3): Promise<Response> {
  let lastErr: Error | null = null;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": SEC_USER_AGENT }, cache: "no-store" });
      if (res.ok) return res;
      if (res.status === 429 || res.status >= 500) {
        lastErr = new Form4Error(`SEC EDGAR request failed: ${res.status} ${url}`);
      } else {
        throw new Form4Error(`SEC EDGAR request failed: ${res.status} ${url}`);
      }
    } catch (e) {
      if (e instanceof Form4Error) throw e; // non-retryable status above
      lastErr = new Form4Error(`Network error contacting SEC EDGAR: ${(e as Error).message}`);
    }
    if (i < attempts - 1) await new Promise((r) => setTimeout(r, 500 * 2 ** i)); // 500ms, 1s, ...
  }
  throw lastErr!;
}

interface TickerEntry {
  cik_str: number;
  ticker: string;
  title: string;
}

let cikMapCache: Map<string, string> | null = null;

// The full mapping file covers every SEC filer (~10k entries) but is only
// fetched once per server instance and then reused for every ticker in
// the universe, rather than once per ticker.
export async function getCikForTicker(ticker: string): Promise<string | null> {
  if (!cikMapCache) {
    const res = await secFetch(TICKERS_JSON_URL);
    const json = (await res.json()) as Record<string, TickerEntry>;
    cikMapCache = new Map(Object.values(json).map((e) => [e.ticker, String(e.cik_str)]));
  }
  return cikMapCache.get(ticker.toUpperCase()) ?? null;
}

interface FilingRef {
  accessionNumber: string;
  filingDate: string;
  indexUrl: string;
}

async function getForm4FilingsPage(cik: string, count: number, start: number): Promise<FilingRef[]> {
  const paddedCik = cik.padStart(10, "0");
  const url = `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${paddedCik}&type=4&dateb=&owner=include&count=${count}&start=${start}&output=atom`;
  const res = await secFetch(url);
  const text = await res.text();

  const cikNum = String(Number(cik));
  const entries: FilingRef[] = [];
  const entryBlocks = text.match(/<entry>[\s\S]*?<\/entry>/g) ?? [];
  for (const block of entryBlocks) {
    const accMatch = block.match(/<accession-number>([^<]+)<\/accession-number>/);
    const dateMatch = block.match(/<filing-date>([^<]+)<\/filing-date>/);
    if (!accMatch || !dateMatch) continue;
    const accessionNumber = accMatch[1];
    const accNoDashes = accessionNumber.replace(/-/g, "");
    entries.push({
      accessionNumber,
      filingDate: dateMatch[1],
      indexUrl: `https://www.sec.gov/Archives/edgar/data/${cikNum}/${accNoDashes}`,
    });
  }
  return entries;
}

async function getRecentForm4Filings(cik: string, count: number): Promise<FilingRef[]> {
  return getForm4FilingsPage(cik, count, 0);
}

// Walks pages of a company's full Form 4 filing history (oldest filings
// are further back in the list; EDGAR returns newest-first) until either
// a page's oldest filing is before `sinceDate`, a page comes back empty,
// or `maxFilings` is hit — used by the offline research backfill, which
// needs years of history per company rather than just the live site's
// "a handful of recent filings" need that getRecentForm4Filings serves.
export async function getForm4FilingsSince(
  cik: string,
  sinceDate: string,
  maxFilings = 400,
  pageSize = 100
): Promise<FilingRef[]> {
  const all: FilingRef[] = [];
  let start = 0;
  while (all.length < maxFilings) {
    const page = await getForm4FilingsPage(cik, pageSize, start);
    if (page.length === 0) break;
    all.push(...page);
    const oldestOnPage = page[page.length - 1].filingDate;
    if (oldestOnPage < sinceDate) break;
    if (page.length < pageSize) break; // short page = no more results
    start += pageSize;
    await new Promise((r) => setTimeout(r, 150)); // stay well under SEC's fair-access rate limit
  }
  return all.filter((f) => f.filingDate >= sinceDate).slice(0, maxFilings);
}

export interface InsiderTransaction {
  ticker: string;
  ownerName: string;
  ownerTitle: string | null;
  transactionCode: string; // 'P' open-market purchase, 'S' open-market sale
  shares: number;
  price: number;
  transactionDate: string;
  filingDate: string;
}

// Officer titles routinely contain "&" (e.g. "Chairman & CEO"), which the
// XML escapes as an entity — decode it back before it reaches React, or it
// renders as the literal text "&amp;" instead of "&".
function decodeXmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function extractTag(block: string, tag: string): string | null {
  const m = block.match(new RegExp(`<${tag}>\\s*<value>([^<]*)</value>`));
  return m ? decodeXmlEntities(m[1].trim()) : null;
}

export async function parseForm4Doc(indexUrl: string, ticker: string, filingDate: string): Promise<InsiderTransaction[]> {
  const dirRes = await secFetch(`${indexUrl}/index.json`);
  const dir = (await dirRes.json()) as { directory: { item: { name: string }[] } };
  const xmlFile = dir.directory.item.find((i) => i.name.toLowerCase().endsWith(".xml"))?.name;
  if (!xmlFile) return [];

  const xmlRes = await secFetch(`${indexUrl}/${xmlFile}`);
  const xml = await xmlRes.text();

  const ownerNameMatch = xml.match(/<rptOwnerName>([^<]*)<\/rptOwnerName>/);
  const ownerTitleMatch = xml.match(/<officerTitle>([^<]*)<\/officerTitle>/);
  const isDirector = /<isDirector>\s*true\s*<\/isDirector>/i.test(xml);
  const ownerName = ownerNameMatch ? decodeXmlEntities(ownerNameMatch[1].trim()) : "Unknown";
  const ownerTitle = (ownerTitleMatch?.[1] ? decodeXmlEntities(ownerTitleMatch[1].trim()) : "") || (isDirector ? "Director" : null);

  const blocks = xml.match(/<nonDerivativeTransaction>[\s\S]*?<\/nonDerivativeTransaction>/g) ?? [];
  const out: InsiderTransaction[] = [];

  for (const block of blocks) {
    const codeMatch = block.match(/<transactionCode>([^<]*)<\/transactionCode>/);
    const code = codeMatch?.[1]?.trim();
    // Only open-market purchases (P) and sales (S) reflect a real
    // discretionary trading decision — grants, tax-withholding, option
    // exercises, and gifts (A/F/M/G/...) aren't "an insider chose to buy
    // or sell" the way this feature means it, so they're left out.
    if (code !== "P" && code !== "S") continue;

    const shares = Number(extractTag(block, "transactionShares") ?? "0");
    const price = Number(extractTag(block, "transactionPricePerShare") ?? "0");
    const dateMatch = block.match(/<transactionDate>\s*<value>([^<]*)<\/value>/);
    if (shares <= 0 || price <= 0) continue;

    out.push({
      ticker,
      ownerName,
      ownerTitle,
      transactionCode: code,
      shares,
      price,
      transactionDate: dateMatch?.[1]?.trim() ?? filingDate,
      filingDate,
    });
  }

  return out;
}

// Walks the most recent filings for a company until it has collected up
// to `maxTransactions` qualifying (P/S) transactions or run out of
// filings to check — most Form 4s are grants/withholding, so the first
// filing alone often has nothing usable.
export async function getRecentInsiderTransactions(
  ticker: string,
  cik: string,
  maxTransactions = 5,
  filingsToCheck = 8
): Promise<InsiderTransaction[]> {
  const filings = await getRecentForm4Filings(cik, filingsToCheck);
  const collected: InsiderTransaction[] = [];

  for (const filing of filings) {
    if (collected.length >= maxTransactions) break;
    try {
      const txns = await parseForm4Doc(filing.indexUrl, ticker, filing.filingDate);
      collected.push(...txns);
    } catch {
      continue; // one malformed/unusual filing shouldn't block the rest
    }
    await new Promise((r) => setTimeout(r, 150)); // stay well under SEC's fair-access rate limit
  }

  return collected.slice(0, maxTransactions);
}
