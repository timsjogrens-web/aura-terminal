"use client";

import { useEffect, useState, useCallback } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Sparkline from "@/components/Sparkline";
import SignalBadge from "@/components/SignalBadge";
import { useQuotes } from "@/lib/useQuotes";
import { formatPct, formatPrice } from "@/lib/format";
import { buildComment } from "@/lib/comment";

interface WatchlistEntry {
  ticker: string;
  company_name: string | null;
  sector: string | null;
  added_at: string;
}

interface SearchResult {
  symbol: string;
  description: string;
}

export default function WatchlistPage() {
  const { data } = useQuotes();
  const [watchlist, setWatchlist] = useState<WatchlistEntry[]>([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadWatchlist = useCallback(() => {
    fetch("/api/watchlist")
      .then((r) => r.json())
      .then((json) => setWatchlist(json.watchlist ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadWatchlist();
  }, [loadWatchlist]);

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

  async function addTicker(ticker: string) {
    setAdding(true);
    setError(null);
    try {
      const res = await fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Could not add ticker.");
        return;
      }
      setQuery("");
      setResults([]);
      loadWatchlist();
    } finally {
      setAdding(false);
    }
  }

  async function removeTicker(ticker: string) {
    await fetch("/api/watchlist", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticker }),
    });
    loadWatchlist();
  }

  const quoteMap = new Map((data?.quotes ?? []).map((q) => [q.ticker, q]));

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <section className="mx-auto max-w-4xl w-full px-4 sm:px-6 pt-12 pb-16 flex-1">
        <h1 className="font-serif font-bold text-3xl sm:text-4xl text-[var(--text-primary)] mb-2">
          Your Watchlist
        </h1>
        <p className="text-[var(--text-secondary)] mb-8">
          Add any US equity by symbol. Saved to your account, not just this browser.
        </p>

        <div className="relative mb-10">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value.toUpperCase())}
            placeholder="Search ticker or company (e.g. NFLX)"
            className="w-full rounded-md border border-[var(--surface-border)] bg-[var(--surface)] px-4 py-3 font-mono text-[var(--text-primary)] outline-none focus:border-[var(--gold)]"
          />
          {results.length > 0 && (
            <div className="absolute z-10 mt-1 w-full rounded-md border border-[var(--surface-border)] bg-[var(--surface-2)] shadow-xl overflow-hidden">
              {results.map((r) => (
                <button
                  key={r.symbol}
                  disabled={adding}
                  onClick={() => addTicker(r.symbol)}
                  className="w-full text-left px-4 py-2.5 hover:bg-black/30 flex items-center justify-between gap-3 disabled:opacity-50"
                >
                  <span className="font-mono font-semibold text-[var(--text-primary)]">{r.symbol}</span>
                  <span className="text-sm text-[var(--text-secondary)] truncate">{r.description}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {error && <p className="text-sm text-[var(--red)] mb-6">{error}</p>}

        {watchlist.length === 0 ? (
          <div className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] p-8 text-center text-[var(--text-secondary)]">
            Nothing on your watchlist yet. Search for a symbol above to add one.
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {watchlist.map((w) => {
              const q = quoteMap.get(w.ticker);
              return (
                <div
                  key={w.ticker}
                  className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] p-5"
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <p className="text-lg font-sans font-bold text-[var(--text-primary)]">{w.ticker}</p>
                      <p className="text-sm text-[var(--text-secondary)]">{w.company_name}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      {q && <SignalBadge signal={q.signal} score={q.score} />}
                      <button
                        onClick={() => removeTicker(w.ticker)}
                        className="text-xs text-[var(--text-muted)] hover:text-[var(--red)] border border-[var(--surface-border)] rounded px-2 py-1"
                      >
                        Remove
                      </button>
                    </div>
                  </div>

                  {q ? (
                    <>
                      <div className="flex items-end justify-between gap-3 mb-3">
                        <div className="flex items-baseline gap-3">
                          <p className="text-2xl font-mono font-semibold text-[var(--text-primary)]">
                            {q.price !== null ? `$${formatPrice(q.price)}` : "—"}
                          </p>
                          {q.change_pct !== null && (
                            <span
                              className={`font-mono text-sm ${
                                q.change_pct >= 0 ? "text-[var(--green)]" : "text-[var(--red)]"
                              }`}
                            >
                              {formatPct(q.change_pct)}
                            </span>
                          )}
                        </div>
                        <Sparkline data={q.sparkline} />
                      </div>
                      <p className="text-sm text-[var(--text-secondary)]">
                        {q.error ? <span className="text-[var(--red)]">{q.error}</span> : buildComment(q)}
                      </p>
                      {q.next_earnings && (
                        <p className="text-xs font-mono text-[var(--text-muted)] mt-3 border-t border-[var(--surface-border)] pt-3">
                          Next earnings:{" "}
                          <span className="text-[var(--text-secondary)]">{q.next_earnings}</span>
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-[var(--text-muted)]">Fetching live data…</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <Footer />
    </div>
  );
}
