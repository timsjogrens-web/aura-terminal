import { db } from "./db";
import { CORE_UNIVERSE } from "./universe";
import { getCikForTicker, getRecentInsiderTransactions, Form4Error } from "./secForm4";

const INSERT_SQL = `
  INSERT OR IGNORE INTO insider_trades
    (ticker, owner_name, owner_title, transaction_code, shares, price, value, transaction_date, filing_date, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`;

export async function refreshInsiderTradesOne(ticker: string) {
  const cik = await getCikForTicker(ticker);
  if (!cik) {
    return { ok: false, skipped: true, reason: "No SEC CIK found for this ticker." };
  }

  const txns = await getRecentInsiderTransactions(ticker, cik);
  const now = new Date().toISOString();

  for (const t of txns) {
    await db.execute({
      sql: INSERT_SQL,
      args: [
        t.ticker,
        t.ownerName,
        t.ownerTitle,
        t.transactionCode,
        t.shares,
        t.price,
        t.shares * t.price,
        t.transactionDate,
        t.filingDate,
        now,
      ],
    });
  }

  return { ok: true, transactionsFound: txns.length };
}

// Covers the core universe only: this runs synchronously from a button
// press and needs a SEC lookup per stock, which doesn't fit in one request
// for the whole (much larger) tracked universe.
export async function refreshAllInsiderTrades() {
  const results: Array<{ ticker: string; ok: boolean; [key: string]: unknown }> = [];
  for (const entry of CORE_UNIVERSE) {
    try {
      const r = await refreshInsiderTradesOne(entry.ticker);
      results.push({ ticker: entry.ticker, ...r });
    } catch (e) {
      const message = e instanceof Form4Error ? e.message : "Unknown error fetching Form 4 data.";
      results.push({ ticker: entry.ticker, ok: false, error: message });
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  return results;
}
