"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ManagerAvatar from "@/components/ManagerAvatar";
import { formatPct, timeAgo } from "@/lib/format";

interface LeaderboardEntry {
  slug: string;
  name: string;
  fund: string;
  isAura: boolean;
  returnPct: number | null;
  coveragePct: number | null;
  asOfDate: string | null;
}

export default function LeaderboardPage() {
  const [entries, setEntries] = useState<LeaderboardEntry[] | null>(null);
  const [cachedAt, setCachedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/leaderboard")
      .then((r) => r.json())
      .then((json) => {
        if (json.error) setError(json.error);
        else {
          setEntries(json.entries);
          setCachedAt(json.cachedAt);
        }
      })
      .catch(() => setError("Could not load the leaderboard."));
  }, []);

  const ranked = (entries ?? [])
    .filter((e) => e.returnPct !== null)
    .sort((a, b) => (b.returnPct ?? -Infinity) - (a.returnPct ?? -Infinity));
  const unranked = (entries ?? []).filter((e) => e.returnPct === null);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <section className="mx-auto max-w-3xl w-full px-4 sm:px-6 pt-12 pb-16 flex-1">
        <h1 className="font-serif font-bold text-3xl sm:text-4xl text-[var(--text-primary)] mb-2">
          Leaderboard
        </h1>
        <p className="text-[var(--text-secondary)] mb-1 max-w-2xl">
          Aura&rsquo;s own paper portfolio against 12 famous fund managers &mdash; ranked by price
          performance of their disclosed holdings since each one&rsquo;s last 13F filing date.
        </p>
        <p className="text-xs text-[var(--text-muted)] mb-8 max-w-2xl">
          13F filings never disclose a cost basis, so this isn&rsquo;t their real trading return —
          it&rsquo;s what the priced portion of their disclosed portfolio has done since it was
          filed. &ldquo;Coverage&rdquo; shows how much of their reported portfolio value that
          actually covers; a manager with lots of unresolved tickers gets thinner, less reliable
          coverage.
          {cachedAt && <> Updated {timeAgo(cachedAt)}.</>}
        </p>

        {error && (
          <div className="rounded-lg border border-[rgba(239,68,68,0.35)] bg-[rgba(239,68,68,0.08)] px-4 py-3 text-sm text-[var(--red)] mb-8">
            {error}
          </div>
        )}

        {!entries && !error && <p className="text-[var(--text-muted)]">Loading…</p>}

        {ranked.length > 0 && (
          <div className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] overflow-hidden mb-6">
            {ranked.map((e, i) => (
              <Link
                key={e.slug}
                href={e.isAura ? "/paper" : `/investors/${e.slug}`}
                className={`flex items-center gap-4 px-5 py-4 border-b border-[var(--surface-border)] last:border-0 hover:bg-black/20 transition-colors ${
                  e.isAura ? "bg-[rgba(245,165,36,0.05)]" : ""
                }`}
              >
                <span className="font-mono text-sm text-[var(--text-muted)] w-6 shrink-0">{i + 1}</span>
                <ManagerAvatar slug={e.slug} name={e.name} size={40} />
                <div className="min-w-0 flex-1">
                  <p className={`font-sans font-bold truncate ${e.isAura ? "text-[var(--gold)]" : "text-[var(--text-primary)]"}`}>
                    {e.name}
                  </p>
                  <p className="text-xs text-[var(--text-secondary)] truncate">
                    {e.fund}
                    {!e.isAura && e.coveragePct !== null && ` · ${e.coveragePct.toFixed(0)}% coverage`}
                  </p>
                </div>
                <span
                  className={`font-mono text-lg font-bold whitespace-nowrap ${
                    (e.returnPct ?? 0) >= 0 ? "text-[var(--green)]" : "text-[var(--red)]"
                  }`}
                >
                  {formatPct(e.returnPct)}
                </span>
              </Link>
            ))}
          </div>
        )}

        {unranked.length > 0 && (
          <p className="text-xs text-[var(--text-muted)]">
            No data yet for: {unranked.map((e) => e.name).join(", ")}.
          </p>
        )}
      </section>

      <Footer />
    </div>
  );
}
