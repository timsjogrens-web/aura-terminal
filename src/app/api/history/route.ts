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

// Comparing against the very next refresh (sometimes minutes later) meant
// a two-cent wobble counted as a real "hit" or "miss". A call is now only
// judged against a snapshot at least MIN_HOURS_LATER afterwards, and only
// counts once the price has actually moved at least MIN_MOVE_PCT either
// way — enough time and magnitude for the move to mean something, rather
// than diluting the hit rate with noise. Smaller/too-soon moves are left
// unscored (—) until a later snapshot qualifies.
const MIN_HOURS_LATER = 4;
const MIN_MOVE_PCT = 5;

function computeHitRate(rows: HistoryRow[]) {
  // A BUY-family call "hits" if price ends up meaningfully higher; a
  // SELL-family call "hits" if it ends up meaningfully lower. HOLD isn't scored.
  let hits = 0;
  let evaluated = 0;
  const withOutcome = rows.map((row, i) => {
    let outcome: "hit" | "miss" | null = null;
    let matched: HistoryRow | undefined;

    if (row.price != null && row.signal && row.timestamp) {
      const rowTime = new Date(row.timestamp).getTime();
      for (let j = i + 1; j < rows.length; j++) {
        const candidate = rows[j];
        if (candidate.price == null || !candidate.timestamp) continue;
        const hoursLater = (new Date(candidate.timestamp).getTime() - rowTime) / 3_600_000;
        if (hoursLater < MIN_HOURS_LATER) continue;
        matched = candidate;
        break;
      }

      if (matched && matched.price != null) {
        const pctMove = ((matched.price - row.price) / row.price) * 100;
        if (Math.abs(pctMove) >= MIN_MOVE_PCT) {
          if (row.signal.includes("BUY") && pctMove > 0) outcome = "hit";
          else if (row.signal.includes("BUY") && pctMove < 0) outcome = "miss";
          else if (row.signal.includes("SELL") && pctMove < 0) outcome = "hit";
          else if (row.signal.includes("SELL") && pctMove > 0) outcome = "miss";
        }
      }

      if (outcome) {
        evaluated++;
        if (outcome === "hit") hits++;
      }
    }

    return {
      ...row,
      nextPrice: matched?.price ?? null,
      nextTimestamp: matched?.timestamp ?? null,
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
