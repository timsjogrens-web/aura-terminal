"use client";

import Header from "@/components/Header";
import TickerBar from "@/components/TickerBar";
import StatCards from "@/components/StatCards";
import StockCard from "@/components/StockCard";
import Screener from "@/components/Screener";
import Footer from "@/components/Footer";
import StatusBanner from "@/components/StatusBanner";
import { useQuotes } from "@/lib/useQuotes";
import { DEFAULT_UNIVERSE } from "@/lib/universe";

export default function MarketsPage() {
  const { data, fetchError, reload } = useQuotes();
  const quotes = data?.quotes ?? [];
  const topBuys = [...quotes]
    .filter((q) => q.signal === "STRONG BUY" || q.signal === "BUY")
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, 3);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <TickerBar quotes={quotes} />

      <section className="mx-auto max-w-7xl w-full px-4 sm:px-6 pt-10 pb-4">
        <p className="text-xs font-mono font-semibold tracking-[0.2em] text-[var(--gold)] mb-2">
          SIGNALMOTOR &middot; {DEFAULT_UNIVERSE.length} US-AKTIER
        </p>
        <h1 className="font-serif font-bold text-3xl sm:text-4xl text-[var(--text-primary)]">
          Marknader
        </h1>
      </section>

      <StatCards quotes={quotes} />
      <StatusBanner data={data} fetchError={fetchError} onRefresh={reload} />

      <section className="mx-auto max-w-7xl w-full px-4 sm:px-6 grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6 pb-16">
        <div>
          <h2 className="font-sans font-bold text-lg text-[var(--text-primary)] flex items-center gap-2 mb-4">
            <svg viewBox="0 0 24 24" className="h-5 w-5 text-[var(--green)]" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 17l6-6 4 4 8-8" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M17 7h4v4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Dagens köpsignaler
          </h2>
          <div className="flex flex-col gap-4">
            {topBuys.length > 0 ? (
              topBuys.map((q) => <StockCard key={q.ticker} q={q} />)
            ) : (
              <div className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] p-6 text-sm text-[var(--text-secondary)]">
                {data?.apiKeyConfigured
                  ? "Inga starka köpsignaler just nu."
                  : "Väntar på FINNHUB_API_KEY för att beräkna signaler."}
              </div>
            )}
          </div>
        </div>

        <Screener quotes={quotes} />
      </section>

      <Footer />
    </div>
  );
}
