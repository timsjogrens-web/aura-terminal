// Officer/director/10%-owner trading disclosures (SEC Form 4) — same
// free, public EDGAR data source as the 13F client, just a different
// filing type and scoped to individual companies instead of fund managers.

const SEC_USER_AGENT = "Candor (personal finance dashboard) contact@candor.example";
const TICKERS_JSON_URL = "https://www.sec.gov/files/company_tickers.json";

export class Form4Error extends Error {}

async function secFetch(url: string): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(url, { headers: { "User-Agent": SEC_USER_AGENT }, cache: "no-store" });
  } catch (e) {
    throw new Form4Error(`Network error contacting SEC EDGAR: ${(e as Error).message}`);
  }
  if (!res.ok) throw new Form4Error(`SEC EDGAR request failed: ${res.status} ${url}`);
  return res;
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

async function getRecentForm4Filings(cik: string, count: number): Promise<FilingRef[]> {
  const paddedCik = cik.padStart(10, "0");
  const url = `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${paddedCik}&type=4&dateb=&owner=include&count=${count}&output=atom`;
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

async function parseForm4Doc(indexUrl: string, ticker: string, filingDate: string): Promise<InsiderTransaction[]> {
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
