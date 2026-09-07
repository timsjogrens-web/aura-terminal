import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

interface AlertRow {
  id: number;
  ticker: string;
  score: number | null;
  price: number | null;
  timestamp: string;
}

// A ticker "triggers" an alert the moment its signal becomes STRONG BUY
// having not been STRONG BUY on its immediately preceding recorded snapshot.
export async function GET(req: NextRequest) {
  const sinceId = Number(req.nextUrl.searchParams.get("sinceId") ?? "0");

  const rows = db
    .prepare(
      `
      SELECT id, ticker, score, price, timestamp FROM (
        SELECT id, ticker, score, price, timestamp, signal,
          LAG(signal) OVER (PARTITION BY ticker ORDER BY id) as prev_signal
        FROM signal_history
      )
      WHERE signal = 'STRONG BUY'
        AND (prev_signal IS NULL OR prev_signal != 'STRONG BUY')
        AND id > ?
      ORDER BY id ASC
      `
    )
    .all(sinceId) as AlertRow[];

  const maxId = db
    .prepare("SELECT COALESCE(MAX(id), 0) as maxId FROM signal_history")
    .get() as { maxId: number };

  return NextResponse.json({ alerts: rows, latestId: maxId.maxId });
}
