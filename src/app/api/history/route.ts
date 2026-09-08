import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

interface HistoryRow {
  id: number;
  ticker: string;
  score: number | null;
  signal: string | null;
  price: number | null;
  timestamp: string;
}

function computeHitRate(rows: HistoryRow[]) {
  // A BUY-family call "hits" if price was higher by the next recorded snapshot;
  // a SELL-family call hits if price was lower. HOLD isn't scored.
  let hits = 0;
  let evaluated = 0;
  const withOutcome = rows.map((row, i) => {
    const next = rows[i + 1];
    let outcome: "hit" | "miss" | null = null;
    if (next && row.price != null && next.price != null && row.signal) {
      const priceRose = next.price > row.price;
      const priceFell = next.price < row.price;
      if (row.signal.includes("BUY") && priceRose) outcome = "hit";
      else if (row.signal.includes("BUY") && priceFell) outcome = "miss";
      else if (row.signal.includes("SELL") && priceFell) outcome = "hit";
      else if (row.signal.includes("SELL") && priceRose) outcome = "miss";

      if (outcome) {
        evaluated++;
        if (outcome === "hit") hits++;
      }
    }
    return {
      ...row,
      nextPrice: next?.price ?? null,
      nextTimestamp: next?.timestamp ?? null,
      outcome,
    };
  });

  return {
    rows: withOutcome,
    hitRate: evaluated > 0 ? Math.round((hits / evaluated) * 100) : null,
    evaluated,
    hits,
  };
}

export async function GET(req: NextRequest) {
  const ticker = req.nextUrl.searchParams.get("ticker");

  if (ticker) {
    const res = await db.execute({
      sql: "SELECT id, ticker, score, signal, price, timestamp FROM signal_history WHERE ticker = ? ORDER BY timestamp ASC",
      args: [ticker.toUpperCase()],
    });
    const rows = res.rows as unknown as HistoryRow[];
    const result = computeHitRate(rows);
    return NextResponse.json({ ticker: ticker.toUpperCase(), ...result });
  }

  const tickersRes = await db.execute(
    "SELECT ticker, COUNT(*) as entries, MAX(timestamp) as last_timestamp FROM signal_history GROUP BY ticker ORDER BY last_timestamp DESC"
  );
  const tickers = tickersRes.rows as unknown as {
    ticker: string;
    entries: number;
    last_timestamp: string;
  }[];

  const allRowsRes = await db.execute(
    "SELECT id, ticker, score, signal, price, timestamp FROM signal_history ORDER BY ticker, timestamp ASC"
  );
  const allRows = allRowsRes.rows as unknown as HistoryRow[];

  const byTicker = new Map<string, HistoryRow[]>();
  for (const row of allRows) {
    if (!byTicker.has(row.ticker)) byTicker.set(row.ticker, []);
    byTicker.get(row.ticker)!.push(row);
  }

  let totalHits = 0;
  let totalEvaluated = 0;
  let strongBuyHits = 0;
  let strongBuyEvaluated = 0;
  for (const rows of byTicker.values()) {
    const { rows: withOutcome, hits, evaluated } = computeHitRate(rows);
    totalHits += hits;
    totalEvaluated += evaluated;
    for (const r of withOutcome) {
      if (r.signal === "STRONG BUY" && r.outcome) {
        strongBuyEvaluated++;
        if (r.outcome === "hit") strongBuyHits++;
      }
    }
  }

  return NextResponse.json({
    tickers,
    overallHitRate: totalEvaluated > 0 ? Math.round((totalHits / totalEvaluated) * 100) : null,
    overallEvaluated: totalEvaluated,
    strongBuyHitRate: strongBuyEvaluated > 0 ? Math.round((strongBuyHits / strongBuyEvaluated) * 100) : null,
    strongBuyEvaluated,
  });
}
