"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { DEFAULT_UNIVERSE } from "@/lib/universe";
import { formatValue } from "@/lib/investors";
import ManagerAvatar from "@/components/ManagerAvatar";

interface TopHolding {
  ticker: string;
  issuer: string;
  pct: number;
}

interface NewPosition {
  ticker: string;
  issuer: string;
  value: number;
}

interface ManagerData {
  slug: string;
  name: string;
  fund: string;
  filingDate: string | null;
  totalValue: number;
  holdingsCount: number;
  topHoldings: TopHolding[];
  newPositions: NewPosition[];
}


export default function InvestorsPage() {
  const [managers, setManagers] = useState<ManagerData[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const trackedTickers = new Set(DEFAULT_UNIVERSE.map((e) => e.ticker));

  function load() {
    fetch("/api/investors")
      .then((r) => r.json())
      .then((json) => {
        if (json.error) setError(json.error);
        else setManagers(json.managers);
      })
      .catch(() => setError("Could not load investor data."));
  }

  useEffect(() => {
    load();
  }, []);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await fetch("/api/investors", { method: "POST" });
      load();
    } finally {
      setRefreshing(false);
    }
  }

  const notableMoves = (managers ?? [])
    .flatMap((m) => m.newPositions.map((p) => ({ ...p, managerName: m.name, managerSlug: m.slug })))
    .filter((p) => trackedTickers.has(p.ticker))
    .sort((a, b) => b.value - a.value);

  const hasAnyData = (managers ?? []).some((m) => m.filingDate !== null);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <section className="mx-auto max-w-6xl w-full px-4 sm:px-6 pt-12 pb-16 flex-1">
        <div className="flex items-start justify-between gap-4 flex-wrap mb-2">
          <h1 className="font-serif font-bold text-3xl sm:text-4xl text-[var(--text-primary)]">
            Institutional Investors
          </h1>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="text-xs font-mono border border-[var(--surface-border)] rounded px-3 py-1.5 text-[var(--text-secondary)] hover:text-[var(--gold)] hover:border-[var(--gold-dim)] transition disabled:opacity-50"
          >
            {refreshing ? "Checking SEC…" : "Check for new filings"}
          </button>
        </div>
        <p className="text-[var(--text-secondary)] mb-8 max-w-2xl">
          Tracks the public SEC 13F filings of 12 well-known fund managers — what they hold and
          what changed since their last filing. 13F reports are filed quarterly, up to 45 days
          after quarter-end, so this is never live — it&rsquo;s the most recent disclosed snapshot.
        </p>

        {error && (
          <div className="rounded-lg border border-[rgba(239,68,68,0.35)] bg-[rgba(239,68,68,0.08)] px-4 py-3 text-sm text-[var(--red)] mb-8">
            {error}
          </div>
        )}

        {managers && !hasAnyData && (
          <div className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] p-8 text-center text-[var(--text-secondary)] mb-8">
            No filings loaded yet. Click &ldquo;Check for new filings&rdquo; above to pull the
            latest 13F data from SEC EDGAR (takes a minute or two — 12 filings plus ticker lookups).
          </div>
        )}

        {notableMoves.length > 0 && (
          <div className="rounded-lg border border-[rgba(245,165,36,0.3)] bg-[rgba(245,165,36,0.05)] p-5 mb-8">
            <p className="text-xs font-mono tracking-widest text-[var(--gold)] mb-4">
              NEW POSITIONS IN STOCKS YOU TRACK
            </p>
            <div className="flex flex-col gap-2">
              {notableMoves.map((move, i) => (
                <Link
                  key={i}
                  href={`/stock/${move.ticker}`}
                  className="flex items-center justify-between gap-3 rounded-md px-3 py-2 hover:bg-black/20 transition-colors"
                >
                  <span className="text-sm text-[var(--text-primary)]">
                    <span className="font-mono font-semibold">{move.managerName}</span> opened a
                    new position in <span className="font-mono font-semibold text-[var(--gold)]">{move.ticker}</span>
                  </span>
                  <span className="text-xs font-mono text-[var(--text-secondary)] whitespace-nowrap">
                    {formatValue(move.value)}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {managers && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {managers.map((m) => (
              <Link
                key={m.slug}
                href={`/investors/${m.slug}`}
                className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] p-5 hover:border-[var(--gold-dim)] transition-colors"
              >
                <div className="flex items-center gap-3 mb-4">
                  <ManagerAvatar slug={m.slug} name={m.name} size={44} />
                  <div className="min-w-0">
                    <p className="font-sans font-bold text-[var(--text-primary)] truncate">{m.name}</p>
                    <p className="text-xs text-[var(--text-secondary)] truncate">{m.fund}</p>
                  </div>
                </div>

                {m.filingDate ? (
                  <>
                    <div className="flex items-baseline justify-between mb-3">
                      <span className="font-mono text-xl font-bold text-[var(--text-primary)]">
                        {formatValue(m.totalValue)}
                      </span>
                      <span className="text-xs font-mono text-[var(--text-secondary)]">
                        {m.holdingsCount} holdings
                      </span>
                    </div>
                    {m.topHoldings.length > 0 && (
                      <p className="text-xs font-mono text-[var(--text-secondary)] mb-2">
                        {m.topHoldings
                          .map((h) => `${h.ticker} ${h.pct.toFixed(0)}%`)
                          .join(" · ")}
                      </p>
                    )}
                    <p className="text-xs font-mono text-[var(--text-muted)]">
                      Filed {new Date(m.filingDate).toLocaleDateString()}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-[var(--text-muted)]">No filing data yet.</p>
                )}
              </Link>
            ))}
          </div>
        )}
      </section>

      <Footer />
    </div>
  );
}
