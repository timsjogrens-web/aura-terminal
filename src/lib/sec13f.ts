// Minimal client for SEC EDGAR's public, free 13F-HR (institutional holdings)
// filings — same fetch-based pattern as the Finnhub/Yahoo/Turso clients.
// SEC asks all automated callers to identify themselves with a descriptive
// User-Agent including contact info (https://www.sec.gov/os/webmaster-faq#developers).

const SEC_USER_AGENT = "Candor (personal finance dashboard) contact@candor.example";

export class SecError extends Error {}

async function secFetch(url: string): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { "User-Agent": SEC_USER_AGENT },
      cache: "no-store",
    });
  } catch (e) {
    throw new SecError(`Network error contacting SEC EDGAR: ${(e as Error).message}`);
  }
  if (!res.ok) {
    throw new SecError(`SEC EDGAR request failed: ${res.status} ${url}`);
  }
  return res;
}

export interface LatestFiling {
  accessionNumber: string;
  filingDate: string; // YYYY-MM-DD
  indexUrl: string;
}

export async function getLatestFiling(cik: string): Promise<LatestFiling | null> {
  const paddedCik = cik.padStart(10, "0");
  const url = `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${paddedCik}&type=13F-HR&dateb=&owner=include&count=1&output=atom`;
  const res = await secFetch(url);
  const text = await res.text();

  const accMatch = text.match(/<accession-number>([^<]+)<\/accession-number>/);
  const dateMatch = text.match(/<filing-date>([^<]+)<\/filing-date>/);
  if (!accMatch || !dateMatch) return null;

  const accessionNumber = accMatch[1];
  const accNoDashes = accessionNumber.replace(/-/g, "");
  const cikNum = String(Number(cik));
  const indexUrl = `https://www.sec.gov/Archives/edgar/data/${cikNum}/${accNoDashes}`;

  return { accessionNumber, filingDate: dateMatch[1], indexUrl };
}

// SEC's 2023 rule change requires 13F values in whole dollars, but not
// every filer's software has caught up — some still report in thousands
// (the old convention). The schema gives no explicit unit flag, so this
// uses a legal fact instead of a guess: a 13F filer must manage at least
// $100M to be required to file one at all, so a cover-page total below
// $100M as literal dollars can only mean the true unit is thousands.
export async function getValueScaleFactor(indexUrl: string): Promise<number> {
  const res = await secFetch(`${indexUrl}/primary_doc.xml`);
  const text = await res.text();
  const m = text.match(/<(?:\w+:)?tableValueTotal>([^<]+)<\/(?:\w+:)?tableValueTotal>/);
  if (!m) return 1;
  const total = Number(m[1]);
  return total > 0 && total < 100_000_000 ? 1000 : 1;
}

export interface RawHolding {
  issuer: string;
  titleOfClass: string;
  cusip: string;
  value: number;
  shares: number;
  isOption: boolean;
}

interface SecDirectoryListing {
  directory: { item: { name: string }[] };
}

// Some filers' XML generators emit tags with a namespace prefix (e.g.
// <ns1:infoTable>, <ns1:cusip>), others don't (<infoTable>, <cusip>) — both
// are valid for the same schema. The optional (?:\w+:)? handles either.
function extractTag(block: string, tag: string): string | null {
  const m = block.match(new RegExp(`<(?:\\w+:)?${tag}>([^<]*)</(?:\\w+:)?${tag}>`));
  return m ? m[1].trim() : null;
}

export async function getInfoTableHoldings(indexUrl: string): Promise<RawHolding[]> {
  const dirRes = await secFetch(`${indexUrl}/index.json`);
  const dir = (await dirRes.json()) as SecDirectoryListing;
  const xmlFiles = dir.directory.item
    .map((i) => i.name)
    .filter((n) => n.toLowerCase().endsWith(".xml") && n.toLowerCase() !== "primary_doc.xml");

  if (xmlFiles.length === 0) {
    throw new SecError(`No holdings table found in filing at ${indexUrl}`);
  }

  const xmlRes = await secFetch(`${indexUrl}/${xmlFiles[0]}`);
  const xml = await xmlRes.text();
  const blocks = xml.match(/<(?:\w+:)?infoTable>[\s\S]*?<\/(?:\w+:)?infoTable>/g) ?? [];

  return blocks.map((block) => ({
    issuer: extractTag(block, "nameOfIssuer") ?? "",
    titleOfClass: extractTag(block, "titleOfClass") ?? "",
    cusip: extractTag(block, "cusip") ?? "",
    value: Number(extractTag(block, "value") ?? "0"),
    shares: Number(extractTag(block, "sshPrnamt") ?? "0"),
    isOption: extractTag(block, "putCall") !== null,
  }));
}
