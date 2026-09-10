"use client";

import Link from "next/link";
import Header from "@/components/Header";
import TickerBar from "@/components/TickerBar";
import Hero from "@/components/Hero";
import HowItWorks from "@/components/HowItWorks";
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
      <Hero tickerCount={DEFAULT_UNIVERSE.length} />

      <section className="mx-auto max-w-7xl w-full px-4 sm:px-6 pb-8">
        <div className="rounded-lg border border-[var(--gold-dim)] bg-[rgba(245,165,36,0.06)] px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6">
          <span className="text-xs font-mono font-semibold tracking-widest text-[var(--gold)] shrink-0">
            NEW
          </span>
          <p className="text-sm text-[var(--text-secondary)] flex-1">
            A risk calculator to size your positions safely, and a methodology page laying out
            exactly what we&rsquo;ve tested and what we haven&rsquo;t proven yet.
          </p>
          <div className="flex gap-2 shrink-0">
            <Link
              href="/risk-calculator"
              className="text-xs font-medium text-black bg-[var(--gold)] hover:brightness-110 rounded-md px-3 py-1.5 transition whitespace-nowrap"
            >
              Risk Calculator
            </Link>
            <Link
              href="/methodology"
              className="text-xs font-medium text-[var(--text-primary)] border border-[var(--surface-border)] hover:border-[var(--gold-dim)] rounded-md px-3 py-1.5 transition whitespace-nowrap"
            >
              Methodology
            </Link>
          </div>
        </div>
      </section>

      <HowItWorks />
      <StatCards quotes={quotes} />
      <StatusBanner data={data} fetchError={fetchError} onRefresh={reload} />

      <section className="mx-auto max-w-7xl w-full px-4 sm:px-6 grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6 pb-16">
        <div>
          <h2 className="font-sans font-bold text-lg text-[var(--text-primary)] flex items-center gap-2 mb-4">
            <svg viewBox="0 0 24 24" className="h-5 w-5 text-[var(--green)]" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 17l6-6 4 4 8-8" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M17 7h4v4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Top Buy Signals Today
          </h2>
          <div className="flex flex-col gap-4">
            {topBuys.length > 0 ? (
              topBuys.map((q) => <StockCard key={q.ticker} q={q} />)
            ) : (
              <div className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] p-6 text-sm text-[var(--text-secondary)]">
                {data?.apiKeyConfigured
                  ? "No strong buy signals right now."
                  : "Waiting on FINNHUB_API_KEY to compute signals."}
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
