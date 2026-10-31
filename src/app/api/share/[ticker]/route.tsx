import { ImageResponse } from "next/og";
import { db } from "@/lib/db";

const SIGNAL_COLORS: Record<string, string> = {
  "STRONG BUY": "#22c55e",
  BUY: "#22c55e",
  HOLD: "#f0a020",
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
            background: "#0a0e17",
            color: "#8b93a3",
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

  const signalColor = SIGNAL_COLORS[row.signal ?? ""] ?? "#8b93a3";
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
          background: "#0a0e17",
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
              background: "linear-gradient(135deg, #9cd0f2, #6fb0e0 55%, #3d6f96)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path
                d="M18.78 16.24A8 8 0 1 1 18.78 7.76"
                stroke="#0a0e17"
                strokeWidth="3.1"
                strokeLinecap="round"
              />
              <circle cx="20" cy="12" r="1.9" fill="#0a0e17" />
            </svg>
          </div>
          <div style={{ display: "flex", fontSize: 28, fontWeight: 700, letterSpacing: 1 }}>
            <span style={{ color: "#6fb0e0" }}>CANDOR</span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 24 }}>
            <span style={{ fontSize: 96, fontWeight: 800, color: "#eef1f6" }}>{symbol}</span>
            <span style={{ fontSize: 32, color: "#8b93a3" }}>{row.company_name ?? ""}</span>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 20 }}>
            <span style={{ fontSize: 56, fontWeight: 700, color: "#eef1f6" }}>
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
          <span style={{ fontSize: 22, color: "#576273" }}>
            Not financial advice · as of {asOf}
          </span>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
