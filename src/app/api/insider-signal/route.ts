import { NextRequest, NextResponse } from "next/server";
import { getInsiderSignal } from "@/lib/insiderSignal";

export async function GET(req: NextRequest) {
  const ticker = req.nextUrl.searchParams.get("ticker");
  if (!ticker) {
    return NextResponse.json({ error: "Ticker is required." }, { status: 400 });
  }
  try {
    const signal = await getInsiderSignal(ticker.toUpperCase());
    return NextResponse.json(signal);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message ?? "Failed to load insider signal." }, { status: 502 });
  }
}
