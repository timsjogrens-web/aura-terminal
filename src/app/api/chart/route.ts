import { NextRequest, NextResponse } from "next/server";
import { getChartSeries, isValidChartRange, YahooError } from "@/lib/yahoo";

export async function GET(req: NextRequest) {
  const ticker = req.nextUrl.searchParams.get("ticker");
  const range = req.nextUrl.searchParams.get("range") ?? "1M";

  if (!ticker) {
    return NextResponse.json({ error: "Ticker is required." }, { status: 400 });
  }
  if (!isValidChartRange(range)) {
    return NextResponse.json({ error: `Unsupported range: ${range}` }, { status: 400 });
  }

  try {
    const series = await getChartSeries(ticker.toUpperCase(), range);
    return NextResponse.json({ ticker: ticker.toUpperCase(), range, ...series });
  } catch (e) {
    const message = e instanceof YahooError ? e.message : "Failed to load chart data.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
