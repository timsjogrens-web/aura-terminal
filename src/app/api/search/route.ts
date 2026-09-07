import { NextRequest, NextResponse } from "next/server";
import { searchSymbol, FinnhubError } from "@/lib/finnhub";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q");
  if (!q || q.trim().length < 1) {
    return NextResponse.json({ results: [] });
  }
  if (!process.env.FINNHUB_API_KEY) {
    return NextResponse.json({ error: "FINNHUB_API_KEY is not configured." }, { status: 500 });
  }
  try {
    const res = await searchSymbol(q.trim());
    const results = res.result
      .filter((r) => r.type === "Common Stock" && !r.symbol.includes("."))
      .slice(0, 8);
    return NextResponse.json({ results });
  } catch (e) {
    const message = e instanceof FinnhubError ? e.message : "Search failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
