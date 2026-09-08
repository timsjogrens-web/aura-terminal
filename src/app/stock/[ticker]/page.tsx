"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SignalBadge from "@/components/SignalBadge";
import NewsList from "@/components/NewsList";
import PriceChart from "@/components/PriceChart";
import SignalHistoryTable, { HistoryEntry } from "@/components/SignalHistoryTable";
import { useQuotes } from "@/lib/useQuotes";
import { formatPct, formatPrice } from "@/lib/format";
import { buildComment } from "@/lib/comment";

interface CompanyProfile {
  name?: string;
  finnhubIndustry?: string;
  exchange?: string;
  ipo?: string;
  marketCapitalization?: number;
  weburl?: string;
  country?: string;
  currency?: string;
}

function formatMarketCap(n?: number): string {
  if (!n) return "—";
  // Finnhub reports marketCapitalization in millions of the listing currency.
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}T`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(2)}B`;
  return `$${n.toFixed(0)}M`;
}

export default function StockDetailPage({
  params,
}: {
  params: Promise<{ ticker: string }>;
}) {
  const { ticker: rawTicker } = use(params);
  const ticker = rawTicker.toUpperCase();

  const { data } = useQuotes();
  const quote = data?.quotes.find((q) => q.ticker === ticker) ?? null;

  const [profile, setProfile] = useState<CompanyProfile | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [history, setHistory] = useState<{
    rows: HistoryEntry[];
    hitRate: number | null;
    evaluated: number;
  } | null>(null);

  useEffect(() => {
    fetch(`/api/company?ticker=${ticker}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.error) setProfileError(json.error);
        else setProfile(json.profile);
      })
      .catch(() => setProfileError("Could not load company info."));
  }, [ticker]);

  useEffect(() => {
    fetch(`/api/history?ticker=${ticker}`)
      .then((r) => r.json())
      .then((json) => setHistory(json))
      .catch(() => {});
  }, [ticker]);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <section className="mx-auto max-w-4xl w-full px-4 sm:px-6 pt-10 pb-16 flex-1">
        <Link
          href="/"
          className="text-sm text-[var(--text-secondary)] hover:text-[var(--gold)] inline-flex items-center gap-1 mb-6"
        >
          ← Back to Markets
        </Link>

        <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
          <div>
            <h1 className="font-serif font-bold text-4xl text-[var(--text-primary)]">{ticker}</h1>
            <p className="text-[var(--text-secondary)] mt-1">
              {profile?.name ?? quote?.company_name ?? "Loading…"}
            </p>
          </div>
          {quote && <SignalBadge signal={quote.signal} score={quote.score} />}
        </div>

        {quote && (
          <div className="flex items-baseline gap-3 mb-8">
            <p className="text-4xl font-mono font-semibold text-[var(--text-primary)]">
              {quote.price !== null ? `$${formatPrice(quote.price)}` : "—"}
            </p>
            {quote.change_pct !== null && (
              <span
                className={`font-mono text-lg ${
                  quote.change_pct >= 0 ? "text-[var(--green)]" : "text-[var(--red)]"
                }`}
              >
                {formatPct(quote.change_pct)}
              </span>
            )}
          </div>
        )}

        <div className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] p-5 mb-6">
          <PriceChart ticker={ticker} />
        </div>

        {quote && !quote.error && (
          <div className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] p-5 mb-6">
            <p className="text-xs font-mono tracking-widest text-[var(--text-secondary)] mb-3">
              WHY THIS SCORE
            </p>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed mb-4">
              {buildComment(quote)}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-mono">
              <div>
                <p className="text-[var(--text-secondary)] mb-1">50D SMA</p>
                <p className="text-[var(--text-primary)]">
                  {quote.sma50 !== null ? `$${formatPrice(quote.sma50)}` : "N/A"}
                </p>
              </div>
              <div>
                <p className="text-[var(--text-secondary)] mb-1">RSI(14)</p>
                <p className="text-[var(--text-primary)]">
                  {quote.rsi14 !== null ? quote.rsi14.toFixed(1) : "N/A"}
                </p>
              </div>
              <div>
                <p className="text-[var(--text-secondary)] mb-1">Volume</p>
                <p className="text-[var(--text-primary)]">
                  {quote.volume !== null ? Math.round(quote.volume).toLocaleString() : "N/A"}
                </p>
              </div>
              <div>
                <p className="text-[var(--text-secondary)] mb-1">Avg Volume (20D)</p>
                <p className="text-[var(--text-primary)]">
                  {quote.avg_volume !== null ? Math.round(quote.avg_volume).toLocaleString() : "N/A"}
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] p-5 mb-6">
          <p className="text-xs font-mono tracking-widest text-[var(--text-secondary)] mb-3">
            ABOUT
          </p>
          {profileError ? (
            <p className="text-sm text-[var(--red)]">{profileError}</p>
          ) : !profile ? (
            <p className="text-sm text-[var(--text-secondary)]">Loading…</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-mono">
              <div>
                <p className="text-[var(--text-secondary)] mb-1">Sector</p>
                <p className="text-[var(--text-primary)]">{profile.finnhubIndustry ?? "N/A"}</p>
              </div>
              <div>
                <p className="text-[var(--text-secondary)] mb-1">Exchange</p>
                <p className="text-[var(--text-primary)]">{profile.exchange ?? "N/A"}</p>
              </div>
              <div>
                <p className="text-[var(--text-secondary)] mb-1">Market Cap</p>
                <p className="text-[var(--text-primary)]">
                  {formatMarketCap(profile.marketCapitalization)}
                </p>
              </div>
              <div>
                <p className="text-[var(--text-secondary)] mb-1">IPO Date</p>
                <p className="text-[var(--text-primary)]">{profile.ipo ?? "N/A"}</p>
              </div>
              {profile.weburl && (
                <div className="col-span-2 sm:col-span-4">
                  <p className="text-[var(--text-secondary)] mb-1">Website</p>
                  <a
                    href={profile.weburl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[var(--gold)] hover:underline break-all"
                  >
                    {profile.weburl}
                  </a>
                </div>
              )}
            </div>
          )}
        </div>

        {quote && quote.news.length > 0 && (
          <div className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] p-5 mb-6">
            <NewsList news={quote.news} />
          </div>
        )}

        <div className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] overflow-hidden">
          {!history ? (
            <div className="p-8 text-center text-[var(--text-secondary)] text-sm">Loading history…</div>
          ) : (
            <SignalHistoryTable
              rows={history.rows}
              hitRate={history.hitRate}
              evaluated={history.evaluated}
              title={`${ticker} Signal History`}
            />
          )}
        </div>
      </section>

      <Footer />
    </div>
  );
}
