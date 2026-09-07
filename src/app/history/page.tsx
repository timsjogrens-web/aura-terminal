"use client";

import { useEffect, useState } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { formatPrice } from "@/lib/format";

interface TickerSummary {
  ticker: string;
  entries: number;
  last_timestamp: string;
}

interface HistoryEntry {
  id: number;
  ticker: string;
  score: number | null;
  signal: string | null;
  price: number | null;
  timestamp: string;
  nextPrice: number | null;
  nextTimestamp: string | null;
  outcome: "hit" | "miss" | null;
}

export default function HistoryPage() {
  const [tickers, setTickers] = useState<TickerSummary[]>([]);
  const [overallHitRate, setOverallHitRate] = useState<number | null>(null);
  const [overallEvaluated, setOverallEvaluated] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<{
    rows: HistoryEntry[];
    hitRate: number | null;
    evaluated: number;
  } | null>(null);

  useEffect(() => {
    fetch("/api/history")
      .then((r) => r.json())
      .then((json) => {
        setTickers(json.tickers ?? []);
        setOverallHitRate(json.overallHitRate ?? null);
        setOverallEvaluated(json.overallEvaluated ?? 0);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!selected) {
      setDetail(null);
      return;
    }
    fetch(`/api/history?ticker=${selected}`)
      .then((r) => r.json())
      .then((json) => setDetail(json))
      .catch(() => setDetail(null));
  }, [selected]);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <section className="mx-auto max-w-5xl w-full px-4 sm:px-6 pt-12 pb-16 flex-1">
        <h1 className="font-serif font-bold text-3xl sm:text-4xl text-[var(--text-primary)] mb-2">
          Signal History
        </h1>
        <p className="text-[var(--text-secondary)] mb-8">
          Every score is logged with a timestamp. A call &ldquo;hits&rdquo; when
          price moved in the called direction by the next recorded snapshot.
        </p>

        <div className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] p-5 mb-8 flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="text-xs font-mono tracking-widest text-[var(--text-secondary)] mb-2">
              OVERALL HIT RATE
            </p>
            <p className="text-4xl font-mono font-bold text-[var(--gold)]">
              {overallHitRate !== null ? `${overallHitRate}%` : "—"}
            </p>
          </div>
          <p className="text-sm text-[var(--text-secondary)]">
            {overallEvaluated} scored calls evaluated so far. This grows as the
            refresh job logs more snapshots over time.
          </p>
        </div>

        {tickers.length === 0 ? (
          <div className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] p-8 text-center text-[var(--text-secondary)]">
            No history yet — snapshots are recorded every refresh cycle.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-6">
            <div className="flex flex-col gap-1">
              {tickers.map((t) => (
                <button
                  key={t.ticker}
                  onClick={() => setSelected(t.ticker)}
                  className={`text-left rounded-md px-3 py-2.5 border transition ${
                    selected === t.ticker
                      ? "border-[var(--gold)] bg-[rgba(245,165,36,0.08)]"
                      : "border-transparent hover:border-[var(--surface-border)]"
                  }`}
                >
                  <span className="font-mono font-semibold text-[var(--text-primary)]">{t.ticker}</span>
                  <span className="text-xs text-[var(--text-secondary)] ml-2">{t.entries} entries</span>
                </button>
              ))}
            </div>

            <div className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] overflow-hidden">
              {!selected ? (
                <div className="p-8 text-center text-[var(--text-secondary)] text-sm">
                  Select a ticker to see its history.
                </div>
              ) : !detail ? (
                <div className="p-8 text-center text-[var(--text-secondary)] text-sm">Loading…</div>
              ) : (
                <>
                  <div className="p-4 border-b border-[var(--surface-border)] flex items-center justify-between">
                    <p className="font-mono font-bold text-[var(--text-primary)]">{selected}</p>
                    <p className="text-sm font-mono text-[var(--text-secondary)]">
                      Hit rate: {detail.hitRate !== null ? `${detail.hitRate}%` : "—"} ({detail.evaluated} scored)
                    </p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs font-mono tracking-widest text-[var(--text-secondary)] border-b border-[var(--surface-border)]">
                          <th className="px-4 py-2.5">Timestamp</th>
                          <th className="px-4 py-2.5">Signal</th>
                          <th className="px-4 py-2.5">Score</th>
                          <th className="px-4 py-2.5">Price</th>
                          <th className="px-4 py-2.5">Next Price</th>
                          <th className="px-4 py-2.5">Outcome</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...detail.rows].reverse().map((r) => (
                          <tr key={r.id} className="border-b border-[var(--surface-border)]">
                            <td className="px-4 py-2.5 font-mono text-xs text-[var(--text-secondary)]">
                              {new Date(r.timestamp).toLocaleString()}
                            </td>
                            <td className="px-4 py-2.5 font-mono text-xs">{r.signal ?? "—"}</td>
                            <td className="px-4 py-2.5 font-mono text-xs">{r.score ?? "—"}</td>
                            <td className="px-4 py-2.5 font-mono text-xs">
                              {r.price !== null ? `$${formatPrice(r.price)}` : "—"}
                            </td>
                            <td className="px-4 py-2.5 font-mono text-xs">
                              {r.nextPrice !== null ? `$${formatPrice(r.nextPrice)}` : "—"}
                            </td>
                            <td className="px-4 py-2.5 font-mono text-xs">
                              {r.outcome === "hit" && <span className="text-[var(--green)]">HIT</span>}
                              {r.outcome === "miss" && <span className="text-[var(--red)]">MISS</span>}
                              {!r.outcome && <span className="text-[var(--text-muted)]">—</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </section>

      <Footer />
    </div>
  );
}
