import { ImageResponse } from "next/og";
import { db } from "@/lib/db";

const SIGNAL_COLORS: Record<string, string> = {
  "STRONG BUY": "#22c55e",
  BUY: "#22c55e",
  HOLD: "#f5a524",
  SELL: "#ef4444",
  "STRONG SELL": "#ef4444",
};

interface QuoteRow {
  ticker: string;
  company_name: string | null;
  price: number | null;
  change_pct: number | null;
  score: number | null;
  signal: string | null;
  updated_at: string | null;
}

export async function GET(_req: Request, { params }: { params: Promise<{ ticker: string }> }) {
  const { ticker } = await params;
  const symbol = ticker.toUpperCase();

  const res = await db.execute({
    sql: "SELECT ticker, company_name, price, change_pct, score, signal, updated_at FROM quote_cache WHERE ticker = ?",
    args: [symbol],
  });
  const row = res.rows[0] as unknown as QuoteRow | undefined;

  if (!row || row.price === null) {
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#0a0a0a",
            color: "#8f897a",
            fontSize: 36,
            fontFamily: "sans-serif",
          }}
        >
          No data available for {symbol}
        </div>
      ),
      { width: 1200, height: 630 }
    );
  }

  const signalColor = SIGNAL_COLORS[row.signal ?? ""] ?? "#8f897a";
  const changeColor = (row.change_pct ?? 0) >= 0 ? "#22c55e" : "#ef4444";
  const changeSign = (row.change_pct ?? 0) >= 0 ? "+" : "";
  const asOf = row.updated_at ? new Date(row.updated_at).toLocaleDateString("en-US") : "";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#0a0a0a",
          padding: "64px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 8,
              background: "#f5a524",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 16,
              fontWeight: 800,
              color: "#0a0a0a",
              letterSpacing: -0.5,
            }}
          >
            TS
          </div>
          <div style={{ display: "flex", fontSize: 28, fontWeight: 700, letterSpacing: 1 }}>
            <span style={{ color: "#f4f2ec" }}>TS&nbsp;</span>
            <span style={{ color: "#f5a524" }}>TERMINAL</span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 24 }}>
            <span style={{ fontSize: 96, fontWeight: 800, color: "#f4f2ec" }}>{symbol}</span>
            <span style={{ fontSize: 32, color: "#8f897a" }}>{row.company_name ?? ""}</span>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 20 }}>
            <span style={{ fontSize: 56, fontWeight: 700, color: "#f4f2ec" }}>
              ${row.price?.toFixed(2)}
            </span>
            <span style={{ fontSize: 32, fontWeight: 600, color: changeColor }}>
              {changeSign}
              {row.change_pct?.toFixed(2)}%
            </span>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              border: `2px solid ${signalColor}`,
              borderRadius: 12,
              padding: "14px 28px",
              color: signalColor,
              fontSize: 32,
              fontWeight: 700,
            }}
          >
            {row.signal ?? "N/A"}
            {row.score !== null && (
              <span style={{ opacity: 0.7, fontSize: 26 }}>{row.score}%</span>
            )}
          </div>
          <span style={{ fontSize: 22, color: "#5c584d" }}>
            Not financial advice · as of {asOf}
          </span>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
