"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Sparkline from "@/components/Sparkline";
import SignalBadge from "@/components/SignalBadge";
import NewsList from "@/components/NewsList";
import CompanyLogo from "@/components/CompanyLogo";
import { useQuotes } from "@/lib/useQuotes";
import { useWatchlist } from "@/lib/WatchlistContext";
import { useAuthStatus } from "@/lib/useAuthStatus";
import { formatPct, formatPrice } from "@/lib/format";
import { buildComment } from "@/lib/comment";

interface SearchResult {
  symbol: string;
  description: string;
}

export default function WatchlistPage() {
  const auth = useAuthStatus();
  // Watchlist edits stay admin-only (one shared list, see WatchlistButton).
  const loggedIn = auth ? auth.isAdmin : null;
  const { data } = useQuotes();
  const { entries, add, remove } = useWatchlist();
  const watchlist = Array.from(entries.values()).sort(
    (a, b) => new Date(b.added_at).getTime() - new Date(a.added_at).getTime()
  );
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

async function addTicker(ticker: string, description?: string) {
    setAdding(true);
    setError(null);
    try {
      const result = await add(ticker, description);
      if (!result.ok) {
        setError(result.error ?? "Kunde inte lägga till aktien.");
        return;
      }
      setQuery("");
      setResults([]);
    } finally {
      setAdding(false);
    }
  }

  const quoteMap = new Map((data?.quotes ?? []).map((q) => [q.ticker, q]));

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <section className="mx-auto max-w-4xl w-full px-4 sm:px-6 pt-12 pb-16 flex-1">
        <h1 className="font-serif font-bold text-3xl sm:text-4xl text-[var(--text-primary)] mb-2">
          Din bevakningslista
        </h1>
        <p className="text-[var(--text-secondary)] mb-8">
          Lägg till valfri amerikansk aktie via ticker. Det här är en delad lista för hela sajten
          (inte per konto), så bara administratören kan ändra den just nu.
        </p>

        {auth && !auth.isAdmin && (
          <div className="rounded-lg border border-[var(--gold-dim)] bg-[rgba(245,165,36,0.06)] px-4 py-3 mb-6 text-sm text-[var(--text-secondary)]">
            Du tittar på bevakningslistan i visningsläge.{" "}
            {auth.loggedIn ? (
              "Bara administratören kan lägga till eller ta bort aktier här."
            ) : (
              <>
                <Link href="/login" className="text-[var(--gold)] underline">
                  Logga in
                </Link>{" "}
                som administratör för att lägga till eller ta bort aktier.
              </>
            )}
          </div>
        )}

        <div className="relative mb-10">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value.toUpperCase())}
            disabled={loggedIn === false}
            placeholder="Sök ticker eller bolag (t.ex. NFLX)"
            className="w-full rounded-md border border-[var(--surface-border)] bg-[var(--surface)] px-4 py-3 font-mono text-[var(--text-primary)] outline-none focus:border-[var(--gold)] disabled:opacity-50"
          />
          {results.length > 0 && (
            <div className="absolute z-10 mt-1 w-full rounded-md border border-[var(--surface-border)] bg-[var(--surface-2)] shadow-xl overflow-hidden">
              {results.map((r) => (
                <button
                  key={r.symbol}
                  disabled={adding}
                  onClick={() => addTicker(r.symbol, r.description)}
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
            Inget på din bevakningslista ännu. Sök efter en ticker ovan för att lägga till en.
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
                    <div className="flex items-center gap-2.5">
                      <CompanyLogo ticker={w.ticker} logoUrl={q?.logo} size={28} />
                      <div>
                        <Link
                          href={`/stock/${w.ticker}`}
                          className="text-lg font-sans font-bold text-[var(--text-primary)] hover:text-[var(--gold)]"
                        >
                          {w.ticker}
                        </Link>
                        <p className="text-sm text-[var(--text-secondary)]">{w.company_name}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {q && <SignalBadge signal={q.signal} score={q.score} />}
                      <button
                        onClick={() => remove(w.ticker)}
                        disabled={loggedIn === false}
                        title={loggedIn === false ? "Logga in för att ändra bevakningslistan" : undefined}
                        className="text-xs text-[var(--text-muted)] hover:text-[var(--red)] border border-[var(--surface-border)] rounded px-2 py-1 disabled:opacity-50"
                      >
                        Ta bort
                      </button>
                    </div>
                  </div>

                  {q ? (
                    <>
                      <div className="flex items-end justify-between gap-3 mb-3">
                        <div className="flex items-baseline gap-3">
                          <p className="text-2xl font-mono font-semibold text-[var(--text-primary)] whitespace-nowrap">
                            {q.price !== null ? `$${formatPrice(q.price)}` : "—"}
                          </p>
                          {q.change_pct !== null && (
                            <span
                              className={`font-mono text-sm whitespace-nowrap ${
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
                          Nästa rapport:{" "}
                          <span className="text-[var(--text-secondary)]">{q.next_earnings}</span>
                        </p>
                      )}
                      <div className="mt-3">
                        <NewsList news={q.news} />
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-[var(--text-muted)]">Hämtar livedata…</p>
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
