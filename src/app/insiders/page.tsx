"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { timeAgo } from "@/lib/format";

interface InsiderTrade {
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

function formatValue(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

export default function InsidersPage() {
  const [trades, setTrades] = useState<InsiderTrade[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<"all" | "buys">("buys");

  function load() {
    fetch("/api/insiders")
      .then((r) => r.json())
      .then((json) => {
        if (json.error) setError(json.error);
        else setTrades(json.trades);
      })
      .catch(() => setError("Could not load insider trades."));
  }

  useEffect(() => {
    load();
  }, []);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await fetch("/api/insiders", { method: "POST" });
      load();
    } finally {
      setRefreshing(false);
    }
  }

  const visible = (trades ?? []).filter((t) => filter === "all" || t.transaction_code === "P");

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <section className="mx-auto max-w-5xl w-full px-4 sm:px-6 pt-12 pb-16 flex-1">
        <div className="flex items-start justify-between gap-4 flex-wrap mb-2">
          <h1 className="font-serif font-bold text-3xl sm:text-4xl text-[var(--text-primary)]">
            Insider Trading
          </h1>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="text-xs font-mono border border-[var(--surface-border)] rounded px-3 py-1.5 text-[var(--text-secondary)] hover:text-[var(--gold)] hover:border-[var(--gold-dim)] transition disabled:opacity-50"
          >
            {refreshing ? "Checking SEC…" : "Check for new filings"}
          </button>
        </div>
        <p className="text-[var(--text-secondary)] mb-6 max-w-2xl">
          Open-market buys and sells by officers, directors, and 10%+ owners of every stock in the
          tracked universe, from their public SEC Form 4 disclosures. Grants, tax-withholding, and
          option exercises are left out — only actual discretionary purchases and sales.
        </p>

        <div className="flex items-center gap-1 bg-black/30 rounded-lg p-1 border border-[var(--surface-border)] w-fit mb-6">
          <button
            onClick={() => setFilter("buys")}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${
              filter === "buys"
                ? "bg-[var(--surface-2)] text-[var(--text-primary)]"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            Buys only
          </button>
          <button
            onClick={() => setFilter("all")}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${
              filter === "all"
                ? "bg-[var(--surface-2)] text-[var(--text-primary)]"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            All trades
          </button>
        </div>

        {error && (
          <div className="rounded-lg border border-[rgba(239,68,68,0.35)] bg-[rgba(239,68,68,0.08)] px-2.5 sm:px-4 py-3 text-sm text-[var(--red)] mb-8">
            {error}
          </div>
        )}

        {trades && trades.length === 0 && (
          <div className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] p-8 text-center text-[var(--text-secondary)] mb-8">
            No filings loaded yet. Click &ldquo;Check for new filings&rdquo; above to pull the
            latest Form 4 data from SEC EDGAR (30 tickers, takes a minute or two).
          </div>
        )}

        {trades && trades.length > 0 && (
          <div className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] overflow-hidden">
            <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--surface-border)] text-left text-xs font-mono tracking-widest text-[var(--text-muted)]">
                  <th className="px-2.5 sm:px-4 py-3 font-medium">TICKER</th>
                  <th className="px-2.5 sm:px-4 py-3 font-medium">INSIDER</th>
                  <th className="px-2.5 sm:px-4 py-3 font-medium">ACTION</th>
                  <th className="px-2.5 sm:px-4 py-3 font-medium text-right">SHARES</th>
                  <th className="px-2.5 sm:px-4 py-3 font-medium text-right">PRICE</th>
                  <th className="px-2.5 sm:px-4 py-3 font-medium text-right">VALUE</th>
                  <th className="px-2.5 sm:px-4 py-3 font-medium text-right">WHEN</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((t) => (
                  <tr key={t.id} className="border-b border-[var(--surface-border)] last:border-0 hover:bg-black/20 transition-colors">
                    <td className="px-2.5 sm:px-4 py-3">
                      <Link href={`/stock/${t.ticker}`} className="font-mono font-semibold text-[var(--gold)] hover:underline">
                        {t.ticker}
                      </Link>
                    </td>
                    <td className="px-2.5 sm:px-4 py-3">
                      <p className="text-[var(--text-primary)] whitespace-nowrap">{t.owner_name}</p>
                      {t.owner_title && (
                        <p className="text-xs text-[var(--text-muted)] whitespace-nowrap">{t.owner_title}</p>
                      )}
                    </td>
                    <td className="px-2.5 sm:px-4 py-3">
                      <span
                        className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${
                          t.transaction_code === "P"
                            ? "bg-[rgba(34,197,94,0.12)] text-[var(--green)]"
                            : "bg-[rgba(239,68,68,0.12)] text-[var(--red)]"
                        }`}
                      >
                        {t.transaction_code === "P" ? "BUY" : "SELL"}
                      </span>
                    </td>
                    <td className="px-2.5 sm:px-4 py-3 text-right font-mono text-[var(--text-secondary)] whitespace-nowrap">
                      {t.shares.toLocaleString()}
                    </td>
                    <td className="px-2.5 sm:px-4 py-3 text-right font-mono text-[var(--text-secondary)] whitespace-nowrap">
                      ${t.price.toFixed(2)}
                    </td>
                    <td className="px-2.5 sm:px-4 py-3 text-right font-mono text-[var(--text-primary)] whitespace-nowrap">
                      {formatValue(t.value)}
                    </td>
                    <td className="px-2.5 sm:px-4 py-3 text-right text-xs font-mono text-[var(--text-muted)] whitespace-nowrap">
                      {timeAgo(t.transaction_date)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
            {visible.length === 0 && (
              <p className="text-center text-sm text-[var(--text-muted)] py-8">
                No open-market buys in the loaded data yet.
              </p>
            )}
          </div>
        )}
      </section>

      <Footer />
    </div>
  );
}
