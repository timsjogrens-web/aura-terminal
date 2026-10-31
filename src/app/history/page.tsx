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
          Signalhistorik
        </h1>
        <p className="text-[var(--text-secondary)] mb-4">
          Varje poäng loggas med en tidsstämpel. En signal räknas bara som
          &ldquo;träff&rdquo; eller &ldquo;miss&rdquo; när priset rört sig
          minst 5% minst 4 timmar senare — mindre eller för tidiga rörelser
          lämnas obedömda istället för att räknas som brus.
        </p>
        <Link
          href="/track-record"
          className="inline-flex items-center gap-1.5 text-sm text-[var(--accent)] hover:underline mb-8"
        >
          Se en fullständig historisk simulering, inklusive de sämsta perioderna →
        </Link>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          <button
            onClick={() => setShowCurrentPicks((v) => !v)}
            className="text-left rounded-lg border border-[rgba(34,197,94,0.3)] bg-[rgba(34,197,94,0.06)] p-5 hover:border-[rgba(34,197,94,0.5)] transition-colors"
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-mono tracking-widest text-[var(--text-secondary)] mb-2">
                TRÄFFSÄKERHET STRONG BUY
              </p>
              <span className="text-xs font-mono text-[var(--green)]">
                {showCurrentPicks ? "Dölj val ▲" : "Se nuvarande val ▼"}
              </span>
            </div>
            <p className="text-4xl font-mono font-bold text-[var(--green)]">
              {strongBuyHitRate !== null ? `${strongBuyHitRate}%` : "—"}
            </p>
            <p className="text-xs text-[var(--text-secondary)] mt-2">
              {strongBuyEvaluated} STRONG BUY-signaler utvärderade över samtliga spårade aktier.
            </p>
          </button>
          <div className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] p-5">
            <p className="text-xs font-mono tracking-widest text-[var(--text-secondary)] mb-2">
              TOTAL TRÄFFSÄKERHET
            </p>
            <p className="text-4xl font-mono font-bold text-[var(--accent)]">
              {overallHitRate !== null ? `${overallHitRate}%` : "—"}
            </p>
            <p className="text-xs text-[var(--text-secondary)] mt-2">
              {overallEvaluated} utvärderade signaler över alla signaltyper, inte bara STRONG BUY.
            </p>
          </div>
        </div>

        {showCurrentPicks && (
          <div className="rounded-lg border border-[rgba(34,197,94,0.3)] bg-[rgba(34,197,94,0.04)] p-5 mb-8">
            <p className="text-xs font-mono tracking-widest text-[var(--text-secondary)] mb-4">
              NUVARANDE STRONG BUY-VAL
            </p>
            {currentStrongBuys.length === 0 ? (
              <p className="text-sm text-[var(--text-secondary)]">
                Inget poängsätts som STRONG BUY just nu.
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
            Ingen historik ännu — ögonblicksbilder loggas varje uppdateringscykel.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-[220px_minmax(0,1fr)] gap-6">
            <div className="flex flex-col gap-1">
              {tickers.map((t) => (
                <div key={t.ticker} className="flex items-center gap-1">
                  <button
                    onClick={() => setSelected(t.ticker)}
                    className={`flex-1 text-left rounded-md px-3 py-2.5 border transition ${
                      selected === t.ticker
                        ? "border-[var(--accent)] bg-[rgba(111,176,224,0.08)]"
                        : "border-transparent hover:border-[var(--surface-border)]"
                    }`}
                  >
                    <span className="font-mono font-semibold text-[var(--text-primary)]">{t.ticker}</span>
                    <span className="text-xs text-[var(--text-secondary)] ml-2">{t.entries} poster</span>
                  </button>
                  <Link
                    href={`/stock/${t.ticker}`}
                    className="text-xs text-[var(--text-muted)] hover:text-[var(--accent)] px-2"
                    title={`Visa detaljsidan för ${t.ticker}`}
                  >
                    ↗
                  </Link>
                </div>
              ))}
            </div>

            <div className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] overflow-hidden">
              {!selected ? (
                <div className="p-8 text-center text-[var(--text-secondary)] text-sm">
                  Välj en aktie för att se dess historik.
                </div>
              ) : !detail ? (
                <div className="p-8 text-center text-[var(--text-secondary)] text-sm">Laddar…</div>
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
