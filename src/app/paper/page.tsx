"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { formatPct, formatPrice, timeAgo } from "@/lib/format";

interface Position {
  ticker: string;
  shares: number;
  entryPrice: number;
  entryDate: string;
  currentPrice: number;
  value: number;
  returnPct: number;
}

interface Trade {
  id: number;
  ticker: string;
  action: "BUY" | "SELL";
  shares: number;
  price: number;
  timestamp: string;
  reason: string;
}

interface PaperData {
  startingCash: number;
  cash: number;
  totalValue: number;
  totalReturnPct: number;
  startedAt: string | null;
  positions: Position[];
  trades: Trade[];
  spyComparison: { returnPct: number } | null;
}

function formatMoney(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export default function PaperTradingPage() {
  const [data, setData] = useState<PaperData | null>(null);

  useEffect(() => {
    fetch("/api/paper")
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData(null));
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <section className="mx-auto max-w-5xl w-full px-4 sm:px-6 pt-12 pb-16 flex-1">
        <div className="flex items-start justify-between gap-4 flex-wrap mb-2">
          <h1 className="font-serif font-bold text-3xl sm:text-4xl text-[var(--text-primary)]">
            Paper Portfolio
          </h1>
          <span className="text-[10px] font-mono tracking-widest bg-[rgba(239,68,68,0.12)] text-[var(--red)] border border-[rgba(239,68,68,0.35)] rounded px-2 py-1 self-start">
            SIMULATED · NOT REAL MONEY
          </span>
        </div>
        <p className="text-[var(--text-secondary)] mb-8 max-w-2xl">
          A fictional {data ? formatMoney(data.startingCash) : "$100,000"} account that automatically
          buys the instant a stock reaches BUY or STRONG BUY, and sells the instant it drops off —
          no manual entry, no hindsight. This is the signal engine&rsquo;s own track record, priced
          in dollars instead of a hit rate.
        </p>

        {!data && <p className="text-[var(--text-muted)]">Loading…</p>}

        {data && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
              <div className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] p-4">
                <p className="text-xs font-mono tracking-widest text-[var(--text-muted)] mb-1">TOTAL VALUE</p>
                <p className="font-mono text-xl font-bold text-[var(--text-primary)]">
                  {formatMoney(data.totalValue)}
                </p>
              </div>
              <div className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] p-4">
                <p className="text-xs font-mono tracking-widest text-[var(--text-muted)] mb-1">RETURN</p>
                <p
                  className={`font-mono text-xl font-bold ${
                    data.totalReturnPct >= 0 ? "text-[var(--green)]" : "text-[var(--red)]"
                  }`}
                >
                  {formatPct(data.totalReturnPct)}
                </p>
              </div>
              <div className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] p-4">
                <p className="text-xs font-mono tracking-widest text-[var(--text-muted)] mb-1">CASH</p>
                <p className="font-mono text-xl font-bold text-[var(--text-primary)]">
                  {formatMoney(data.cash)}
                </p>
              </div>
              <div className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] p-4">
                <p className="text-xs font-mono tracking-widest text-[var(--text-muted)] mb-1">OPEN POSITIONS</p>
                <p className="font-mono text-xl font-bold text-[var(--text-primary)]">
                  {data.positions.length}
                </p>
              </div>
            </div>

            {data.startedAt && (
              <div className="rounded-lg border border-[rgba(245,165,36,0.3)] bg-[rgba(245,165,36,0.05)] p-5 mb-8 flex items-center justify-between flex-wrap gap-4">
                <div>
                  <p className="text-xs font-mono tracking-widest text-[var(--gold)] mb-1">VS. S&amp;P 500</p>
                  <p className="text-sm text-[var(--text-secondary)]">
                    Same {formatMoney(data.startingCash)} in SPY since the first trade ({timeAgo(data.startedAt)})
                  </p>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className="text-xs font-mono text-[var(--text-muted)]">SIGNAL ENGINE</p>
                    <p
                      className={`font-mono text-lg font-bold ${
                        data.totalReturnPct >= 0 ? "text-[var(--green)]" : "text-[var(--red)]"
                      }`}
                    >
                      {formatPct(data.totalReturnPct)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-mono text-[var(--text-muted)]">S&amp;P 500</p>
                    {data.spyComparison ? (
                      <p
                        className={`font-mono text-lg font-bold ${
                          data.spyComparison.returnPct >= 0 ? "text-[var(--green)]" : "text-[var(--red)]"
                        }`}
                      >
                        {formatPct(data.spyComparison.returnPct)}
                      </p>
                    ) : (
                      <p className="font-mono text-lg text-[var(--text-muted)]">—</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {data.positions.length > 0 && (
              <div className="mb-8">
                <p className="text-xs font-mono tracking-widest text-[var(--text-muted)] mb-3">OPEN POSITIONS</p>
                <div className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[var(--surface-border)] text-left text-xs font-mono tracking-widest text-[var(--text-muted)]">
                        <th className="px-4 py-3 font-medium">TICKER</th>
                        <th className="px-4 py-3 font-medium text-right">SHARES</th>
                        <th className="px-4 py-3 font-medium text-right">ENTRY</th>
                        <th className="px-4 py-3 font-medium text-right">CURRENT</th>
                        <th className="px-4 py-3 font-medium text-right">RETURN</th>
                        <th className="px-4 py-3 font-medium text-right">VALUE</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.positions.map((p) => (
                        <tr key={p.ticker} className="border-b border-[var(--surface-border)] last:border-0">
                          <td className="px-4 py-3">
                            <Link href={`/stock/${p.ticker}`} className="font-mono font-semibold text-[var(--gold)] hover:underline">
                              {p.ticker}
                            </Link>
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-[var(--text-secondary)] whitespace-nowrap">
                            {p.shares.toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-[var(--text-secondary)] whitespace-nowrap">
                            ${formatPrice(p.entryPrice)}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-[var(--text-primary)] whitespace-nowrap">
                            ${formatPrice(p.currentPrice)}
                          </td>
                          <td
                            className={`px-4 py-3 text-right font-mono whitespace-nowrap ${
                              p.returnPct >= 0 ? "text-[var(--green)]" : "text-[var(--red)]"
                            }`}
                          >
                            {formatPct(p.returnPct)}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-[var(--text-primary)] whitespace-nowrap">
                            {formatMoney(p.value)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div>
              <p className="text-xs font-mono tracking-widest text-[var(--text-muted)] mb-3">TRADE LOG</p>
              {data.trades.length === 0 ? (
                <p className="text-[var(--text-muted)] text-sm">
                  No trades yet — the portfolio buys automatically the next time a tracked stock
                  reaches BUY or STRONG BUY.
                </p>
              ) : (
                <div className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[var(--surface-border)] text-left text-xs font-mono tracking-widest text-[var(--text-muted)]">
                        <th className="px-4 py-3 font-medium">ACTION</th>
                        <th className="px-4 py-3 font-medium">TICKER</th>
                        <th className="px-4 py-3 font-medium text-right">SHARES</th>
                        <th className="px-4 py-3 font-medium text-right">PRICE</th>
                        <th className="px-4 py-3 font-medium">REASON</th>
                        <th className="px-4 py-3 font-medium text-right">WHEN</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.trades.map((t) => (
                        <tr key={t.id} className="border-b border-[var(--surface-border)] last:border-0">
                          <td className="px-4 py-3">
                            <span
                              className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${
                                t.action === "BUY"
                                  ? "bg-[rgba(34,197,94,0.12)] text-[var(--green)]"
                                  : "bg-[rgba(239,68,68,0.12)] text-[var(--red)]"
                              }`}
                            >
                              {t.action}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-mono font-semibold text-[var(--text-primary)]">
                            {t.ticker}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-[var(--text-secondary)] whitespace-nowrap">
                            {t.shares.toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-[var(--text-secondary)] whitespace-nowrap">
                            ${formatPrice(t.price)}
                          </td>
                          <td className="px-4 py-3 text-xs font-mono text-[var(--text-muted)] whitespace-nowrap">
                            {t.reason}
                          </td>
                          <td className="px-4 py-3 text-right text-xs font-mono text-[var(--text-muted)] whitespace-nowrap">
                            {timeAgo(t.timestamp)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </section>

      <Footer />
    </div>
  );
}
