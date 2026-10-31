"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import TickerBar from "@/components/TickerBar";
import Hero from "@/components/Hero";
import HowItWorks from "@/components/HowItWorks";
import Footer from "@/components/Footer";
import CompanyLogo from "@/components/CompanyLogo";
import { useQuotes } from "@/lib/useQuotes";
import { DEFAULT_UNIVERSE } from "@/lib/universe";

interface SimTrade {
  ticker: string;
  action: "BUY" | "SELL";
  date: string;
  returnPct: number | null;
}

function formatPct(n: number): string {
  return `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
}

export default function HomePage() {
  const { data } = useQuotes();
  const quotes = data?.quotes ?? [];
  const buySignalCount = quotes.filter((q) => q.signal === "STRONG BUY" || q.signal === "BUY").length;

  // A handful of concrete, checkable examples — real tickers, real dates,
  // real % moves, from the exact same full simulation shown (with the bad
  // periods included, not hidden) on /track-record. Deliberately not
  // shown until there's a link right next to it to that full page — this
  // is a teaser for that page, not a standalone claim.
  const [bestExamples, setBestExamples] = useState<SimTrade[] | null>(null);
  useEffect(() => {
    fetch("/api/track-record")
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (!json?.trades) return;
        const closed = (json.trades as SimTrade[]).filter(
          (t) => t.action === "SELL" && t.returnPct !== null
        );
        const best = [...closed].sort((a, b) => (b.returnPct ?? 0) - (a.returnPct ?? 0)).slice(0, 3);
        setBestExamples(best);
      })
      .catch(() => setBestExamples(null));
  }, []);

  return (
    <div className="relative min-h-screen flex flex-col">
      {/* Spans the whole page (not just the hero) — see .space-bg in
          globals.css for why background-attachment: fixed keeps this from
          stretching/distorting no matter how tall the page's content
          makes this wrapper. Fades out over the page's own last ~18%
          instead of cutting off abruptly wherever the content ends. */}
      <div aria-hidden="true" className="absolute inset-0 space-bg" />
      <div aria-hidden="true" className="space-twinkle" />
      <Header />
      <TickerBar quotes={quotes} />
      <Hero tickerCount={DEFAULT_UNIVERSE.length} />

      <section className="mx-auto max-w-7xl w-full px-4 sm:px-6 pb-12">
        <div className="flex gap-3 flex-wrap mb-3">
          <Link
            href="/signup"
            className="rounded-md bg-[var(--accent)] px-5 py-2.5 font-sans font-bold text-black tracking-wide hover:brightness-110 transition"
          >
            Skapa konto — helt gratis
          </Link>
          <Link
            href="/markets"
            className="rounded-md border border-[var(--surface-border)] px-5 py-2.5 font-sans font-medium text-[var(--text-primary)] hover:border-[var(--accent-dim)] transition"
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

      {bestExamples && bestExamples.length > 0 && (
        <section className="mx-auto max-w-7xl w-full px-4 sm:px-6 pb-12">
          <h2 className="font-sans font-bold text-lg text-[var(--text-primary)] flex items-center gap-2 mb-1.5">
            <svg viewBox="0 0 24 24" className="h-5 w-5 text-[var(--green)]" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2l2.5 6.5L21 9l-5 4.5L17.5 21 12 17l-5.5 4L8 13.5 3 9l6.5-.5z" strokeLinejoin="round" />
            </svg>
            Exempel från den historiska simuleringen
          </h2>
          <p className="text-sm text-[var(--text-secondary)] mb-3 max-w-2xl">
            Inte den riktiga botens egen historik (den har bara körts live i några veckor) — det här
            är samma 2-åriga tillbakablick som på{" "}
            <Link href="/track-record" className="text-[var(--accent)] underline">
              track record-sidan
            </Link>
            : om reglerna hade följts då, vad hade hänt. Utvalda goda exempel, inte ett snitt — samma
            simulering visar även de sämsta perioderna och affärerna där.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {bestExamples.map((t, i) => (
              <Link
                key={i}
                href={`/stock/${t.ticker}`}
                className="rounded-lg border border-[rgba(34,197,94,0.25)] bg-[rgba(34,197,94,0.03)] p-4 flex items-center gap-3 hover:border-[rgba(34,197,94,0.5)] transition"
              >
                <CompanyLogo ticker={t.ticker} size={28} />
                <div className="flex-1 min-w-0">
                  <p className="font-mono font-semibold text-sm text-[var(--text-primary)]">{t.ticker}</p>
                  <p className="text-xs text-[var(--text-muted)]">Såld {t.date}</p>
                </div>
                <p className="font-mono text-lg font-bold text-[var(--green)] shrink-0">
                  {formatPct(t.returnPct ?? 0)}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}

      <HowItWorks />

      <section className="mx-auto max-w-7xl w-full px-4 sm:px-6 pb-16">
        <div className="rounded-lg border border-[var(--accent-dim)] bg-[rgba(111,176,224,0.06)] px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6">
          <span className="text-xs font-mono font-semibold tracking-widest text-[var(--accent)] shrink-0">
            LIVE
          </span>
          <p className="text-sm text-[var(--text-secondary)] flex-1">
            En bot handlar på riktigt just nu, i realtid — köper och säljer automatiskt utifrån
            exakt samma signaler du ser på sajten. Skapa ditt eget papperskonto och följ med, eller
            se hur det går redan.
          </p>
          <div className="flex gap-2 shrink-0 flex-wrap">
            <Link
              href="/paper"
              className="text-xs font-medium text-black bg-[var(--accent)] hover:brightness-110 rounded-md px-3 py-1.5 transition whitespace-nowrap"
            >
              Se boten live
            </Link>
            <Link
              href="/methodology"
              className="text-xs font-medium text-[var(--text-primary)] border border-[var(--surface-border)] hover:border-[var(--accent-dim)] rounded-md px-3 py-1.5 transition whitespace-nowrap"
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
