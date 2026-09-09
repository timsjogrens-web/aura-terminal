import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { MANAGERS } from "@/lib/investors";
import { refreshAllInstitutional } from "@/lib/refreshInstitutional";
import { getSession } from "@/lib/session";

interface HoldingRow {
  cusip: string;
  issuer: string;
  ticker: string | null;
  value: number;
  shares: number;
}

export async function GET() {
  const managers = [];

  for (const m of MANAGERS) {
    const datesRes = await db.execute({
      sql: "SELECT DISTINCT filing_date FROM institutional_holdings WHERE manager_slug = ? ORDER BY filing_date DESC LIMIT 2",
      args: [m.slug],
    });
    const dates = (datesRes.rows as { filing_date: string }[]).map((r) => r.filing_date);

    if (dates.length === 0) {
      managers.push({
        slug: m.slug,
        name: m.name,
        fund: m.fund,
        filingDate: null,
        totalValue: 0,
        holdingsCount: 0,
        topHoldings: [],
        newPositions: [],
      });
      continue;
    }

    const latestDate = dates[0];
    const holdingsRes = await db.execute({
      sql: "SELECT cusip, issuer, ticker, value, shares FROM institutional_holdings WHERE manager_slug = ? AND filing_date = ? ORDER BY value DESC",
      args: [m.slug, latestDate],
    });
    const holdings = holdingsRes.rows as unknown as HoldingRow[];
    const totalValue = holdings.reduce((a, h) => a + Number(h.value), 0);

    const topHoldings = holdings
      .filter((h) => h.ticker)
      .slice(0, 3)
      .map((h) => ({
        ticker: h.ticker,
        issuer: h.issuer,
        pct: totalValue > 0 ? (Number(h.value) / totalValue) * 100 : 0,
      }));

    let newPositions: { ticker: string; issuer: string; value: number }[] = [];
    if (dates.length > 1) {
      const prevRes = await db.execute({
        sql: "SELECT cusip FROM institutional_holdings WHERE manager_slug = ? AND filing_date = ?",
        args: [m.slug, dates[1]],
      });
      const prevCusips = new Set((prevRes.rows as { cusip: string }[]).map((r) => r.cusip));
      newPositions = holdings
        .filter((h) => h.ticker && !prevCusips.has(h.cusip))
        .map((h) => ({ ticker: h.ticker as string, issuer: h.issuer, value: Number(h.value) }));
    }

    managers.push({
      slug: m.slug,
      name: m.name,
      fund: m.fund,
      filingDate: latestDate,
      totalValue,
      holdingsCount: holdings.length,
      topHoldings,
      newPositions,
    });
  }

  return NextResponse.json({ managers });
}

export async function POST() {
  const session = await getSession();
  if (!session.loggedIn) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  try {
    const results = await refreshAllInstitutional();
    return NextResponse.json({ ok: true, results });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
