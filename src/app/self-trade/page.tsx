"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import PriceChart from "@/components/PriceChart";
import CompanyLogo from "@/components/CompanyLogo";
import { formatPct, formatPrice } from "@/lib/format";

interface SearchResult {
  symbol: string;
  description: string;
}

interface LiveQuote {
  ticker: string;
  price: number;
  change: number;
  changePct: number;
  name: string | null;
  logo: string | null;
}

interface Position {
  ticker: string;
  shares: number;
  entryPrice: number;
  entryDate: string;
  currentPrice: number;
  value: number;
  returnPct: number;
  logo?: string | null;
}

interface Trade {
  id: number;
  ticker: string;
  action: "BUY" | "SELL";
  shares: number;
  price: number;
  timestamp: string;
  logo?: string | null;
}

interface PortfolioData {
  startingCash: number;
  cash: number;
  totalValue: number;
  totalReturnPct: number;
  startedAt: string | null;
  positions: Position[];
  trades: Trade[];
}

function formatMoney(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export default function SelfTradePage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [live, setLive] = useState<LiveQuote | null>(null);
  const [liveError, setLiveError] = useState<string | null>(null);
  const [side, setSide] = useState<"BUY" | "SELL">("BUY");
  const [shares, setShares] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [tradeError, setTradeError] = useState<string | null>(null);
  const [portfolio, setPortfolio] = useState<PortfolioData | null>(null);

  const loadPortfolio = useCallback(() => {
    fetch("/api/manual-trade")
      .then((r) => r.json())
      .then(setPortfolio)
      .catch(() => setPortfolio(null));
  }, []);

  useEffect(() => {
    loadPortfolio();
  }, [loadPortfolio]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const id = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(query)}`)
        .then((r) => r.json())
        .then((json) => setResults(json.results ?? []))
        .catch(() => setResults([]));
    }, 300);
    return () => clearTimeout(id);
  }, [query]);

  const selectTicker = useCallback((ticker: string, presetSide?: "BUY" | "SELL") => {
    setSelected(ticker);
    setQuery("");
    setResults([]);
    setLive(null);
    setLiveError(null);
    setShares("");
    setTradeError(null);
    if (presetSide) setSide(presetSide);
    fetch(`/api/quote-lookup?ticker=${ticker}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.error) setLiveError(json.error);
        else setLive(json);
      })
      .catch(() => setLiveError("Could not load a live price."));
  }, []);

  async function submitTrade() {
    if (!selected || !shares) return;
    setSubmitting(true);
    setTradeError(null);
    try {
      const res = await fetch("/api/manual-trade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker: selected, action: side, shares: Number(shares) }),
      });
      const json = await res.json();
      if (!res.ok) {
        setTradeError(json.error ?? "Trade failed.");
        return;
      }
      setShares("");
      loadPortfolio();
      selectTicker(selected, side); // refresh live price after the trade
    } finally {
      setSubmitting(false);
    }
  }

  const cost = live && shares ? Number(shares) * live.price : 0;
  const heldShares = portfolio?.positions.find((p) => p.ticker === selected)?.shares ?? 0;

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <section className="mx-auto max-w-5xl w-full px-4 sm:px-6 pt-12 pb-16 flex-1">
        <div className="flex items-start justify-between gap-4 flex-wrap mb-2">
          <h1 className="font-serif font-bold text-3xl sm:text-4xl text-[var(--text-primary)]">
            Self Trade
          </h1>
          <span className="text-[10px] font-mono tracking-widest bg-[rgba(239,68,68,0.12)] text-[var(--red)] border border-[rgba(239,68,68,0.35)] rounded px-2 py-1 self-start">
            SIMULATED · NOT REAL MONEY
          </span>
        </div>
        <p className="text-[var(--text-secondary)] mb-8 max-w-2xl">
          Your own {portfolio ? formatMoney(portfolio.startingCash) : "$100,000"} account — search any
          stock and trade it yourself, separate from the signal engine&rsquo;s auto-trading paper
          portfolio. See how your own picks stack up against the bot on the{" "}
          <Link href="/paper" className="text-[var(--gold)] hover:underline">
            Paper Portfolio
          </Link>{" "}
          page.
        </p>

        <div className="relative mb-6">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value.toUpperCase())}
            placeholder="Search any stock (e.g. NFLX)"
            className="w-full rounded-md border border-[var(--surface-border)] bg-black/30 px-2.5 sm:px-4 py-3 text-sm font-mono text-[var(--text-primary)] outline-none focus:border-[var(--gold)]"
          />
          {results.length > 0 && (
            <div className="absolute z-10 mt-1 w-full rounded-md border border-[var(--surface-border)] bg-[var(--surface)] shadow-lg overflow-hidden">
              {results.map((r) => (
                <button
                  key={r.symbol}
                  onClick={() => selectTicker(r.symbol)}
                  className="w-full text-left px-4 py-2.5 hover:bg-black/30 flex items-center justify-between gap-3"
                >
                  <span className="font-mono font-semibold text-[var(--text-primary)]">{r.symbol}</span>
                  <span className="text-xs text-[var(--text-secondary)] truncate">{r.description}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {selected && (
          <div className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] p-5 mb-8">
            {liveError && <p className="text-sm text-[var(--red)] mb-3">{liveError}</p>}
            {live && (
              <>
                <div className="flex items-center justify-between gap-4 flex-wrap mb-4">
                  <div className="flex items-center gap-3">
                    <CompanyLogo ticker={live.ticker} logoUrl={live.logo} size={36} />
                    <div>
                      <p className="font-mono font-bold text-lg text-[var(--text-primary)]">{live.ticker}</p>
                      <p className="text-xs text-[var(--text-secondary)]">{live.name}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-2xl font-bold text-[var(--text-primary)]">
                      ${formatPrice(live.price)}
                    </p>
                    <p className={`font-mono text-sm ${live.changePct >= 0 ? "text-[var(--green)]" : "text-[var(--red)]"}`}>
                      {formatPct(live.changePct)}
                    </p>
                  </div>
                </div>

                <div className="mb-5">
                  <PriceChart ticker={live.ticker} changePct={live.changePct} />
                </div>

                <div className="flex gap-1 bg-black/30 rounded-md p-1 border border-[var(--surface-border)] w-fit mb-3">
                  <button
                    onClick={() => setSide("BUY")}
                    className={`px-6 py-1.5 rounded text-sm font-mono font-semibold ${
                      side === "BUY" ? "bg-[rgba(34,197,94,0.15)] text-[var(--green)]" : "text-[var(--text-secondary)]"
                    }`}
                  >
                    BUY
                  </button>
                  <button
                    onClick={() => setSide("SELL")}
                    className={`px-6 py-1.5 rounded text-sm font-mono font-semibold ${
                      side === "SELL" ? "bg-[rgba(239,68,68,0.15)] text-[var(--red)]" : "text-[var(--text-secondary)]"
                    }`}
                  >
                    SELL
                  </button>
                  {side === "SELL" && (
                    <span className="self-center text-xs font-mono text-[var(--text-muted)] pl-2 pr-3">
                      You hold {heldShares.toFixed(4)}
                    </span>
                  )}
                </div>

                <div className="flex items-end gap-3 flex-wrap">
                  <div>
                    <label className="text-xs font-mono tracking-widest text-[var(--text-muted)] block mb-1.5">
                      SHARES
                    </label>
                    <input
                      value={shares}
                      onChange={(e) => setShares(e.target.value.replace(/[^0-9.]/g, ""))}
                      placeholder="0"
                      className="w-32 rounded-md border border-[var(--surface-border)] bg-black/30 px-3 py-2 text-sm font-mono text-[var(--text-primary)] outline-none focus:border-[var(--gold)]"
                    />
                  </div>
                  <p className="text-sm font-mono text-[var(--text-secondary)] pb-2.5">
                    {side === "BUY" ? "Cost" : "Proceeds"}: ${cost.toFixed(2)}
                  </p>
                  <button
                    onClick={submitTrade}
                    disabled={submitting || !shares || Number(shares) <= 0}
                    className={`px-5 py-2 rounded-md text-sm font-semibold transition disabled:opacity-50 ${
                      side === "BUY" ? "bg-[var(--green)] text-black" : "bg-[var(--red)] text-black"
                    }`}
                  >
                    {submitting ? "Submitting…" : `${side} ${live.ticker}`}
                  </button>
                </div>
                {tradeError && <p className="text-sm text-[var(--red)] mt-3">{tradeError}</p>}
              </>
            )}
          </div>
        )}

        {portfolio && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
              <div className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] p-4">
                <p className="text-xs font-mono tracking-widest text-[var(--text-muted)] mb-1">TOTAL VALUE</p>
                <p className="font-mono text-xl font-bold text-[var(--text-primary)]">{formatMoney(portfolio.totalValue)}</p>
              </div>
              <div className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] p-4">
                <p className="text-xs font-mono tracking-widest text-[var(--text-muted)] mb-1">RETURN</p>
                <p className={`font-mono text-xl font-bold ${portfolio.totalReturnPct >= 0 ? "text-[var(--green)]" : "text-[var(--red)]"}`}>
                  {formatPct(portfolio.totalReturnPct)}
                </p>
              </div>
              <div className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] p-4">
                <p className="text-xs font-mono tracking-widest text-[var(--text-muted)] mb-1">CASH</p>
                <p className="font-mono text-xl font-bold text-[var(--text-primary)]">{formatMoney(portfolio.cash)}</p>
              </div>
              <div className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] p-4">
                <p className="text-xs font-mono tracking-widest text-[var(--text-muted)] mb-1">OPEN POSITIONS</p>
                <p className="font-mono text-xl font-bold text-[var(--text-primary)]">{portfolio.positions.length}</p>
              </div>
            </div>

            {portfolio.positions.length > 0 && (
              <div className="mb-8">
                <p className="text-xs font-mono tracking-widest text-[var(--text-muted)] mb-3">OPEN POSITIONS</p>
                <div className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] overflow-hidden">
                  <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[var(--surface-border)] text-left text-xs font-mono tracking-widest text-[var(--text-muted)]">
                        <th className="px-2.5 sm:px-4 py-3 font-medium">TICKER</th>
                        <th className="px-2.5 sm:px-4 py-3 font-medium text-right">SHARES</th>
                        <th className="px-2.5 sm:px-4 py-3 font-medium text-right">AVG COST</th>
                        <th className="px-2.5 sm:px-4 py-3 font-medium text-right">CURRENT</th>
                        <th className="px-2.5 sm:px-4 py-3 font-medium text-right">RETURN</th>
                        <th className="px-2.5 sm:px-4 py-3 font-medium text-right">VALUE</th>
                        <th className="px-2.5 sm:px-4 py-3 font-medium"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {portfolio.positions.map((p) => (
                        <tr key={p.ticker} className="border-b border-[var(--surface-border)] last:border-0">
                          <td className="px-2.5 sm:px-4 py-3">
                            <Link href={`/stock/${p.ticker}`} className="flex items-center gap-2 font-mono font-semibold text-[var(--gold)] hover:underline">
                              <CompanyLogo ticker={p.ticker} logoUrl={p.logo} size={20} />
                              {p.ticker}
                            </Link>
                          </td>
                          <td className="px-2.5 sm:px-4 py-3 text-right font-mono text-[var(--text-secondary)] whitespace-nowrap">
                            {p.shares.toFixed(4)}
                          </td>
                          <td className="px-2.5 sm:px-4 py-3 text-right font-mono text-[var(--text-secondary)] whitespace-nowrap">
                            ${formatPrice(p.entryPrice)}
                          </td>
                          <td className="px-2.5 sm:px-4 py-3 text-right font-mono text-[var(--text-primary)] whitespace-nowrap">
                            ${formatPrice(p.currentPrice)}
                          </td>
                          <td className={`px-2.5 sm:px-4 py-3 text-right font-mono whitespace-nowrap ${p.returnPct >= 0 ? "text-[var(--green)]" : "text-[var(--red)]"}`}>
                            {formatPct(p.returnPct)}
                          </td>
                          <td className="px-2.5 sm:px-4 py-3 text-right font-mono text-[var(--text-primary)] whitespace-nowrap">
                            {formatMoney(p.value)}
                          </td>
                          <td className="px-2.5 sm:px-4 py-3 text-right">
                            <button
                              onClick={() => selectTicker(p.ticker, "SELL")}
                              className="text-xs font-mono border border-[var(--surface-border)] rounded px-2 py-1 text-[var(--text-secondary)] hover:text-[var(--red)] hover:border-[var(--red)]"
                            >
                              Sell
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>
                </div>
              </div>
            )}

            <div>
              <p className="text-xs font-mono tracking-widest text-[var(--text-muted)] mb-3">TRADE LOG</p>
              {portfolio.trades.length === 0 ? (
                <p className="text-[var(--text-muted)] text-sm">No trades yet — search a stock above and place your first one.</p>
              ) : (
                <div className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] overflow-hidden">
                  <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[var(--surface-border)] text-left text-xs font-mono tracking-widest text-[var(--text-muted)]">
                        <th className="px-2.5 sm:px-4 py-3 font-medium">ACTION</th>
                        <th className="px-2.5 sm:px-4 py-3 font-medium">TICKER</th>
                        <th className="px-2.5 sm:px-4 py-3 font-medium text-right">SHARES</th>
                        <th className="px-2.5 sm:px-4 py-3 font-medium text-right">PRICE</th>
                        <th className="px-2.5 sm:px-4 py-3 font-medium text-right">WHEN</th>
                      </tr>
                    </thead>
                    <tbody>
                      {portfolio.trades.map((t) => (
                        <tr key={t.id} className="border-b border-[var(--surface-border)] last:border-0">
                          <td className="px-2.5 sm:px-4 py-3">
                            <span
                              className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${
                                t.action === "BUY" ? "bg-[rgba(34,197,94,0.12)] text-[var(--green)]" : "bg-[rgba(239,68,68,0.12)] text-[var(--red)]"
                              }`}
                            >
                              {t.action}
                            </span>
                          </td>
                          <td className="px-2.5 sm:px-4 py-3">
                            <Link href={`/stock/${t.ticker}`} className="flex items-center gap-2 font-mono font-semibold text-[var(--text-primary)] hover:text-[var(--gold)]">
                              <CompanyLogo ticker={t.ticker} logoUrl={t.logo} size={20} />
                              {t.ticker}
                            </Link>
                          </td>
                          <td className="px-2.5 sm:px-4 py-3 text-right font-mono text-[var(--text-secondary)] whitespace-nowrap">
                            {t.shares.toFixed(4)}
                          </td>
                          <td className="px-2.5 sm:px-4 py-3 text-right font-mono text-[var(--text-secondary)] whitespace-nowrap">
                            ${formatPrice(t.price)}
                          </td>
                          <td className="px-2.5 sm:px-4 py-3 text-right text-xs font-mono text-[var(--text-muted)] whitespace-nowrap">
                            {new Date(t.timestamp).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>
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
