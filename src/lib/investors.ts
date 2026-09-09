export interface InstitutionalManager {
  slug: string;
  name: string;
  fund: string;
  cik: string; // verified against SEC EDGAR company search, not guessed
}

// SEC 13F filers only — Nancy Pelosi-style congressional trade disclosures
// come from a different, non-13F source and aren't included here.
export const MANAGERS: InstitutionalManager[] = [
  { slug: "buffett", name: "Warren Buffett", fund: "Berkshire Hathaway", cik: "1067983" },
  { slug: "ackman", name: "Bill Ackman", fund: "Pershing Square", cik: "2026053" },
  { slug: "druckenmiller", name: "Stanley Druckenmiller", fund: "Duquesne Family Office", cik: "1536411" },
  { slug: "tepper", name: "David Tepper", fund: "Appaloosa", cik: "1656456" },
  { slug: "klarman", name: "Seth Klarman", fund: "Baupost Group", cik: "1061768" },
  { slug: "coleman", name: "Chase Coleman", fund: "Tiger Global", cik: "1167483" },
  { slug: "hohn", name: "Chris Hohn", fund: "TCI Fund Management", cik: "1647251" },
  { slug: "li-lu", name: "Li Lu", fund: "Himalaya Capital", cik: "1709323" },
  { slug: "smith", name: "Terry Smith", fund: "Fundsmith", cik: "1569205" },
  { slug: "soros", name: "George Soros", fund: "Soros Fund Management", cik: "1029160" },
  { slug: "gates", name: "Bill Gates", fund: "Gates Foundation Trust", cik: "1166559" },
  { slug: "burry", name: "Michael Burry", fund: "Scion Asset Management", cik: "1649339" },
];

export const MANAGERS_BY_SLUG = new Map(MANAGERS.map((m) => [m.slug, m]));
