"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SignalHistoryTable, { HistoryEntry } from "@/components/SignalHistoryTable";
import SignalBadge from "@/components/SignalBadge";
import { useQuotes } from "@/lib/useQuotes";
import { formatPrice } from "@/lib/format";

interface TickerSummary {
  ticker: string;
  entries: number;
  last_timestamp: string;
}

export default function HistoryPage() {
  const [tickers, setTickers] = useState<TickerSummary[]>([]);
  const [overallHitRate, setOverallHitRate] = useState<number | null>(null);
  const [overallEvaluated, setOverallEvaluated] = useState(0);
  const [strongBuyHitRate, setStrongBuyHitRate] = useState<number | null>(null);
  const [strongBuyEvaluated, setStrongBuyEvaluated] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<{
    rows: HistoryEntry[];
    hitRate: number | null;
    evaluated: number;
  } | null>(null);
  const [showCurrentPicks, setShowCurrentPicks] = useState(false);
  const { data: quotesData } = useQuotes();
  const currentStrongBuys = (quotesData?.quotes ?? [])
    .filter((q) => q.signal === "STRONG BUY")
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

  useEffect(() => {
    fetch("/api/history")
      .then((r) => r.json())
      .then((json) => {
        setTickers(json.tickers ?? []);
        setOverallHitRate(json.overallHitRate ?? null);
        setOverallEvaluated(json.overallEvaluated ?? 0);
        setStrongBuyHitRate(json.strongBuyHitRate ?? null);
        setStrongBuyEvaluated(json.strongBuyEvaluated ?? 0);
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          <button
            onClick={() => setShowCurrentPicks((v) => !v)}
            className="text-left rounded-lg border border-[rgba(34,197,94,0.3)] bg-[rgba(34,197,94,0.06)] p-5 hover:border-[rgba(34,197,94,0.5)] transition-colors"
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-mono tracking-widest text-[var(--text-secondary)] mb-2">
                STRONG BUY HIT RATE
              </p>
              <span className="text-xs font-mono text-[var(--green)]">
                {showCurrentPicks ? "Hide picks ▲" : "See current picks ▼"}
              </span>
            </div>
            <p className="text-4xl font-mono font-bold text-[var(--green)]">
              {strongBuyHitRate !== null ? `${strongBuyHitRate}%` : "—"}
            </p>
            <p className="text-xs text-[var(--text-secondary)] mt-2">
              {strongBuyEvaluated} STRONG BUY calls evaluated across every stock tracked.
            </p>
          </button>
          <div className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] p-5">
            <p className="text-xs font-mono tracking-widest text-[var(--text-secondary)] mb-2">
              OVERALL HIT RATE
            </p>
            <p className="text-4xl font-mono font-bold text-[var(--gold)]">
              {overallHitRate !== null ? `${overallHitRate}%` : "—"}
            </p>
            <p className="text-xs text-[var(--text-secondary)] mt-2">
              {overallEvaluated} scored calls across every signal type, not just STRONG BUY.
            </p>
          </div>
        </div>

        {showCurrentPicks && (
          <div className="rounded-lg border border-[rgba(34,197,94,0.3)] bg-[rgba(34,197,94,0.04)] p-5 mb-8">
            <p className="text-xs font-mono tracking-widest text-[var(--text-secondary)] mb-4">
              CURRENT STRONG BUY PICKS
            </p>
            {currentStrongBuys.length === 0 ? (
              <p className="text-sm text-[var(--text-secondary)]">
                Nothing is scoring STRONG BUY right now.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {currentStrongBuys.map((q) => (
                  <Link
                    key={q.ticker}
                    href={`/stock/${q.ticker}`}
                    className="flex items-center justify-between gap-3 rounded-md px-3 py-2.5 border border-transparent hover:border-[var(--surface-border)] hover:bg-black/20 transition-colors"
                  >
                    <div className="flex items-baseline gap-3">
                      <span className="font-mono font-semibold text-[var(--text-primary)]">
                        {q.ticker}
                      </span>
                      <span className="text-sm text-[var(--text-secondary)]">{q.company_name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-sm text-[var(--text-primary)]">
                        {q.price !== null ? `$${formatPrice(q.price)}` : "—"}
                      </span>
                      <SignalBadge signal={q.signal} score={q.score} />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {tickers.length === 0 ? (
          <div className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] p-8 text-center text-[var(--text-secondary)]">
            No history yet — snapshots are recorded every refresh cycle.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-6">
            <div className="flex flex-col gap-1">
              {tickers.map((t) => (
                <div key={t.ticker} className="flex items-center gap-1">
                  <button
                    onClick={() => setSelected(t.ticker)}
                    className={`flex-1 text-left rounded-md px-3 py-2.5 border transition ${
                      selected === t.ticker
                        ? "border-[var(--gold)] bg-[rgba(245,165,36,0.08)]"
                        : "border-transparent hover:border-[var(--surface-border)]"
                    }`}
                  >
                    <span className="font-mono font-semibold text-[var(--text-primary)]">{t.ticker}</span>
                    <span className="text-xs text-[var(--text-secondary)] ml-2">{t.entries} entries</span>
                  </button>
                  <Link
                    href={`/stock/${t.ticker}`}
                    className="text-xs text-[var(--text-muted)] hover:text-[var(--gold)] px-2"
                    title={`View ${t.ticker} detail page`}
                  >
                    ↗
                  </Link>
                </div>
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
                <SignalHistoryTable
                  rows={detail.rows}
                  hitRate={detail.hitRate}
                  evaluated={detail.evaluated}
                  title={selected}
                />
              )}
            </div>
          </div>
        )}
      </section>

      <Footer />
    </div>
  );
}
