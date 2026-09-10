"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SignalBadge from "@/components/SignalBadge";
import WatchlistButton from "@/components/WatchlistButton";
import ShareButton from "@/components/ShareButton";
import CompanyLogo from "@/components/CompanyLogo";
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

// Finnhub's free profile endpoint doesn't include a description paragraph,
// so this composes one from the real structured fields it does give us
// rather than inventing prose we can't back up.
function buildCompanySummary(ticker: string, profile: CompanyProfile): string {
  const parts: string[] = [];
  const name = profile.name ?? ticker;
  let sentence = name;
  if (profile.finnhubIndustry) sentence += ` operates in the ${profile.finnhubIndustry} industry`;
  if (profile.exchange) sentence += `${profile.finnhubIndustry ? " and" : ""} trades on ${profile.exchange}`;
  parts.push(sentence + ".");
  if (profile.marketCapitalization) {
    parts.push(`Current market cap is ${formatMarketCap(profile.marketCapitalization)}.`);
  }
  if (profile.ipo) {
    parts.push(`Listed since ${profile.ipo}.`);
  }
  return parts.join(" ");
}

export default function StockDetailPage({
  params,
}: {
  params: Promise<{ ticker: string }>;
}) {
  const { ticker: rawTicker } = use(params);
  const ticker = rawTicker.toUpperCase();
  const router = useRouter();

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
        <button
          onClick={() => router.back()}
          className="text-sm text-[var(--text-secondary)] hover:text-[var(--gold)] inline-flex items-center gap-1 mb-6"
        >
          ← Back
        </button>

        <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
          <div className="flex items-center gap-3">
            <CompanyLogo ticker={ticker} logoUrl={quote?.logo} size={44} />
            <div>
              <h1 className="font-serif font-bold text-4xl text-[var(--text-primary)]">{ticker}</h1>
              <p className="text-[var(--text-secondary)] mt-1">
                {profile?.name ?? quote?.company_name ?? "Loading…"}
              </p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <div className="flex items-center gap-2">
              <WatchlistButton
                ticker={ticker}
                companyName={profile?.name ?? quote?.company_name ?? undefined}
                sector={quote?.sector ?? undefined}
              />
              {quote && <SignalBadge signal={quote.signal} score={quote.score} />}
              <ShareButton ticker={ticker} />
            </div>
            {quote?.signal &&
              history &&
              history.rows.length > 0 &&
              (() => {
                const latest = history.rows[history.rows.length - 1];
                if (latest.signal !== quote.signal) return null;
                return (
                  <span className="text-xs font-mono text-[var(--gold)] bg-[rgba(245,165,36,0.1)] border border-[rgba(245,165,36,0.3)] rounded px-2 py-1 whitespace-nowrap">
                    ● Since {new Date(latest.timestamp).toLocaleString()}
                  </span>
                );
              })()}
          </div>
        </div>

        {quote && (
          <div className="flex items-baseline gap-3 mb-8">
            <p className="text-4xl font-mono font-semibold text-[var(--text-primary)] whitespace-nowrap">
              {quote.price !== null ? `$${formatPrice(quote.price)}` : "—"}
            </p>
            {quote.change_pct !== null && (
              <span
                className={`font-mono text-lg whitespace-nowrap ${
                  quote.change_pct >= 0 ? "text-[var(--green)]" : "text-[var(--red)]"
                }`}
              >
                {formatPct(quote.change_pct)}
              </span>
            )}
          </div>
        )}

        <div className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] p-5 mb-6">
          <PriceChart ticker={ticker} changePct={quote?.change_pct} />
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
            <>
              <p className="text-sm text-[var(--text-secondary)] leading-relaxed mb-4">
                {buildCompanySummary(ticker, profile)}
              </p>
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
                <div>
                  <p className="text-[var(--text-secondary)] mb-1">Next Earnings</p>
                  <p className="text-[var(--text-primary)]">{quote?.next_earnings ?? "N/A"}</p>
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
            </>
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
              defaultFilter="STRONG BUY"
            />
          )}
        </div>
      </section>

      <Footer />
    </div>
  );
}
