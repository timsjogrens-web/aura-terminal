import { NextResponse } from "next/server";
import { getLeaderboard } from "@/lib/managerPerformance";

export async function GET() {
  try {
    const result = await getLeaderboard();
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
