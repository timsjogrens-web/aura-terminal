import { NextResponse } from "next/server";
import { FinnhubError } from "@/lib/finnhub";

export interface MarketNewsItem {
  headline: string;
  summary: string;
  url: string;
  source: string;
  image: string;
  datetime: number;
  category: string;
}

export async function GET() {
  const key = process.env.FINNHUB_API_KEY;
  if (!key) {
    return NextResponse.json({ error: "FINNHUB_API_KEY is not configured." }, { status: 500 });
  }

  try {
    const res = await fetch(
      `https://finnhub.io/api/v1/news?category=general&token=${key}`,
      { cache: "no-store" }
    );
    if (!res.ok) {
      throw new FinnhubError(`Finnhub API error: ${res.status} ${res.statusText}`, res.status);
    }
    const items = (await res.json()) as MarketNewsItem[];
    return NextResponse.json({ news: items.slice(0, 30) });
  } catch (e) {
    const message = e instanceof FinnhubError ? e.message : "Failed to load market news.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
