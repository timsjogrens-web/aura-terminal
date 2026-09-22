"use client";

import Link from "next/link";
import Header from "@/components/Header";
import TickerBar from "@/components/TickerBar";
import Hero from "@/components/Hero";
import HowItWorks from "@/components/HowItWorks";
import Footer from "@/components/Footer";
import { useQuotes } from "@/lib/useQuotes";
import { DEFAULT_UNIVERSE } from "@/lib/universe";

export default function HomePage() {
  const { data } = useQuotes();
  const quotes = data?.quotes ?? [];
  const buySignalCount = quotes.filter((q) => q.signal === "STRONG BUY" || q.signal === "BUY").length;

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <TickerBar quotes={quotes} />
      <Hero tickerCount={DEFAULT_UNIVERSE.length} />

      <section className="mx-auto max-w-7xl w-full px-4 sm:px-6 pb-12">
        <div className="flex gap-3 flex-wrap mb-3">
          <Link
            href="/signup"
            className="rounded-md bg-[var(--gold)] px-5 py-2.5 font-sans font-bold text-black tracking-wide hover:brightness-110 transition"
          >
            Skapa konto — helt gratis
          </Link>
          <Link
            href="/markets"
            className="rounded-md border border-[var(--surface-border)] px-5 py-2.5 font-sans font-medium text-[var(--text-primary)] hover:border-[var(--gold-dim)] transition"
          >
            Utforska marknaden utan konto
          </Link>
        </div>
        <p className="text-sm text-[var(--text-secondary)]">
          Inget kreditkort, inga avgifter &mdash; skapa ett konto och få tillgång till
          {buySignalCount > 0 ? ` ${buySignalCount} aktuella köpsignaler` : " dagens köp- och säljsignaler"},
          eget papperskonto med $100 000 att öva med, och en egen bevakningslista.
        </p>
      </section>

      <HowItWorks />

      <section className="mx-auto max-w-7xl w-full px-4 sm:px-6 pb-16">
        <div className="rounded-lg border border-[var(--gold-dim)] bg-[rgba(245,165,36,0.06)] px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6">
          <span className="text-xs font-mono font-semibold tracking-widest text-[var(--gold)] shrink-0">
            NYTT
          </span>
          <p className="text-sm text-[var(--text-secondary)] flex-1">
            Se en fullständig historisk simulering av att följa varje signal — inklusive de
            sämsta perioderna — plus en riskkalkylator och en metodik-sida som visar exakt vad
            vi testat och vad vi ännu inte bevisat.
          </p>
          <div className="flex gap-2 shrink-0 flex-wrap">
            <Link
              href="/track-record"
              className="text-xs font-medium text-black bg-[var(--gold)] hover:brightness-110 rounded-md px-3 py-1.5 transition whitespace-nowrap"
            >
              Track record
            </Link>
            <Link
              href="/risk-calculator"
              className="text-xs font-medium text-[var(--text-primary)] border border-[var(--surface-border)] hover:border-[var(--gold-dim)] rounded-md px-3 py-1.5 transition whitespace-nowrap"
            >
              Riskkalkylator
            </Link>
            <Link
              href="/methodology"
              className="text-xs font-medium text-[var(--text-primary)] border border-[var(--surface-border)] hover:border-[var(--gold-dim)] rounded-md px-3 py-1.5 transition whitespace-nowrap"
            >
              Metodik
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
