import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { refreshAllInsiderTrades } from "@/lib/refreshInsiders";
import { getSession } from "@/lib/session";

interface InsiderRow {
  id: number;
  ticker: string;
  owner_name: string;
  owner_title: string | null;
  transaction_code: string;
  shares: number;
  price: number;
  value: number;
  transaction_date: string;
  filing_date: string;
}

export async function GET() {
  const res = await db.execute(
    "SELECT id, ticker, owner_name, owner_title, transaction_code, shares, price, value, transaction_date, filing_date FROM insider_trades ORDER BY transaction_date DESC, id DESC LIMIT 200"
  );
  const trades = res.rows as unknown as InsiderRow[];
  return NextResponse.json({ trades });
}

export async function POST() {
  const session = await getSession();
  if (!session.loggedIn) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  try {
    const results = await refreshAllInsiderTrades();
    return NextResponse.json({ ok: true, results });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
