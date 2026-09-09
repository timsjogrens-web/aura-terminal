import { db } from "./db";
import { MANAGERS, InstitutionalManager } from "./investors";
import { getLatestFiling, getInfoTableHoldings, getValueScaleFactor, SecError } from "./sec13f";
import { resolveCusipsToTickers } from "./openfigi";

// 13F filers often split one position across several managed accounts
// within the same filing (e.g. Berkshire's sub-portfolios), so the raw
// rows need aggregating by CUSIP before they represent an actual position.
// Ticker resolution (an OpenFIGI call per unique CUSIP) is limited to the
// largest positions — plenty for what gets displayed, and keeps refreshes
// from burning through OpenFIGI's rate limit on funds with hundreds of
// tiny holdings.
const TOP_N_RESOLVE = 25;

interface AggregatedHolding {
  cusip: string;
  issuer: string;
  value: number;
  shares: number;
}

export async function refreshInstitutionalOne(manager: InstitutionalManager) {
  const filing = await getLatestFiling(manager.cik);
  if (!filing) {
    return { ok: false, skipped: true, reason: "No 13F-HR filing found for this CIK." };
  }

  const existingRes = await db.execute({
    sql: "SELECT COUNT(*) as c FROM institutional_holdings WHERE manager_slug = ? AND filing_date = ?",
    args: [manager.slug, filing.filingDate],
  });
  const alreadyHave = Number((existingRes.rows[0] as { c: number }).c) > 0;
  if (alreadyHave) {
    return { ok: true, skipped: true, reason: "Already have this filing.", filingDate: filing.filingDate };
  }

  const [raw, scaleFactor] = await Promise.all([
    getInfoTableHoldings(filing.indexUrl),
    getValueScaleFactor(filing.indexUrl),
  ]);

  const byCusip = new Map<string, AggregatedHolding>();
  for (const h of raw) {
    if (!h.cusip || h.isOption) continue;
    const value = h.value * scaleFactor;
    const existing = byCusip.get(h.cusip);
    if (existing) {
      existing.value += value;
      existing.shares += h.shares;
    } else {
      byCusip.set(h.cusip, { cusip: h.cusip, issuer: h.issuer, value, shares: h.shares });
    }
  }

  const aggregated = Array.from(byCusip.values()).sort((a, b) => b.value - a.value);
  if (aggregated.length === 0) {
    return { ok: false, reason: "Filing had no equity holdings to parse." };
  }

  const top = aggregated.slice(0, TOP_N_RESOLVE);
  const tickerMap = await resolveCusipsToTickers(top.map((h) => h.cusip));

  const now = new Date().toISOString();
  for (const h of aggregated) {
    const ticker = tickerMap.get(h.cusip) ?? null;
    await db.execute({
      sql: `INSERT INTO institutional_holdings (manager_slug, cusip, issuer, ticker, value, shares, filing_date, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [manager.slug, h.cusip, h.issuer, ticker, h.value, h.shares, filing.filingDate, now],
    });
  }

  return { ok: true, filingDate: filing.filingDate, holdingsCount: aggregated.length };
}

export async function refreshAllInstitutional() {
  const results: Array<{ manager: string; ok: boolean; [key: string]: unknown }> = [];
  for (const manager of MANAGERS) {
    try {
      const r = await refreshInstitutionalOne(manager);
      results.push({ manager: manager.slug, ...r });
    } catch (e) {
      const message = e instanceof SecError ? e.message : "Unknown error fetching 13F data.";
      results.push({ manager: manager.slug, ok: false, error: message });
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return results;
}
