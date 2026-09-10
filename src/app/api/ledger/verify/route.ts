import { NextResponse } from "next/server";
import { verifyLedger } from "@/lib/ledger";

// Recomputes the entire signal ledger's hash chain from scratch and
// reports whether it's intact — anyone can call this to check the track
// record hasn't been quietly edited after the fact. See src/lib/ledger.ts.
export async function GET() {
  const result = await verifyLedger();
  return NextResponse.json(result);
}
