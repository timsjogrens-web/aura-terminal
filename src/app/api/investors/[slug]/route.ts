import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { MANAGERS_BY_SLUG } from "@/lib/investors";

interface HoldingRow {
  cusip: string;
  issuer: string;
  ticker: string | null;
  value: number;
  shares: number;
}

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const manager = MANAGERS_BY_SLUG.get(slug);
  if (!manager) {
    return NextResponse.json({ error: "Unknown manager." }, { status: 404 });
  }

  const datesRes = await db.execute({
    sql: "SELECT DISTINCT filing_date FROM institutional_holdings WHERE manager_slug = ? ORDER BY filing_date DESC LIMIT 2",
    args: [slug],
  });
  const dates = (datesRes.rows as { filing_date: string }[]).map((r) => r.filing_date);

  if (dates.length === 0) {
    return NextResponse.json({
      manager,
      filingDate: null,
      previousFilingDate: null,
      totalValue: 0,
      holdings: [],
    });
  }

  const latestDate = dates[0];
  const holdingsRes = await db.execute({
    sql: "SELECT cusip, issuer, ticker, value, shares FROM institutional_holdings WHERE manager_slug = ? AND filing_date = ? ORDER BY value DESC",
    args: [slug, latestDate],
  });
  const holdings = holdingsRes.rows as unknown as HoldingRow[];
  const totalValue = holdings.reduce((a, h) => a + Number(h.value), 0);

  let previousCusips = new Set<string>();
  let closedPositions: { cusip: string; issuer: string; ticker: string | null }[] = [];
  const previousFilingDate = dates[1] ?? null;

  if (previousFilingDate) {
    const prevRes = await db.execute({
      sql: "SELECT cusip, issuer, ticker FROM institutional_holdings WHERE manager_slug = ? AND filing_date = ?",
      args: [slug, previousFilingDate],
    });
    const prevRows = prevRes.rows as unknown as HoldingRow[];
    previousCusips = new Set(prevRows.map((r) => r.cusip));
    const latestCusips = new Set(holdings.map((h) => h.cusip));
    closedPositions = prevRows
      .filter((r) => !latestCusips.has(r.cusip))
      .map((r) => ({ cusip: r.cusip, issuer: r.issuer, ticker: r.ticker }));
  }

  const enriched = holdings.map((h) => ({
    cusip: h.cusip,
    issuer: h.issuer,
    ticker: h.ticker,
    value: Number(h.value),
    shares: Number(h.shares),
    pct: totalValue > 0 ? (Number(h.value) / totalValue) * 100 : 0,
    isNew: previousFilingDate ? !previousCusips.has(h.cusip) : false,
  }));

  return NextResponse.json({
    manager,
    filingDate: latestDate,
    previousFilingDate,
    totalValue,
    holdings: enriched,
    closedPositions,
  });
}
