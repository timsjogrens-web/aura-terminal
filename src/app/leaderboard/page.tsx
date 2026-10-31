"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ManagerAvatar from "@/components/ManagerAvatar";
import { LogoMark } from "@/components/Logo";
import { formatPct, timeAgo } from "@/lib/format";

interface LeaderboardEntry {
  slug: string;
  name: string;
  fund: string;
  isOwn: boolean;
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
      .catch(() => setError("Kunde inte ladda topplistan."));
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
          Mot proffsen
        </h1>
        <p className="text-[var(--text-secondary)] mb-1 max-w-2xl">
          Candors egna papperskonto mot 12 kända fondförvaltare &mdash; rankat efter
          kursutveckling på deras offentliga innehav sedan vars och ens senaste 13F-anmälan.
        </p>
        <p className="text-xs text-[var(--text-muted)] mb-8 max-w-2xl">
          13F-anmälningar redovisar aldrig ett anskaffningsvärde, så det här är inte deras
          verkliga handelsavkastning — det är vad den prissatta delen av deras redovisade
          portfölj gjort sedan anmälan. &ldquo;Täckning&rdquo; visar hur stor andel av deras
          rapporterade portföljvärde som faktiskt täcks; en förvaltare med många ospårade
          innehav får tunnare, mindre tillförlitlig täckning.
          {cachedAt && <> Uppdaterad {timeAgo(cachedAt)}.</>}
        </p>

        {error && (
          <div className="rounded-lg border border-[rgba(239,68,68,0.35)] bg-[rgba(239,68,68,0.08)] px-4 py-3 text-sm text-[var(--red)] mb-8">
            {error}
          </div>
        )}

        {!entries && !error && <p className="text-[var(--text-muted)]">Laddar…</p>}

        {ranked.length > 0 && (
          <div className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] overflow-hidden mb-6">
            {ranked.map((e, i) => (
              <Link
                key={e.slug}
                href={e.isOwn ? "/paper" : `/investors/${e.slug}`}
                className={`flex items-center gap-4 px-5 py-4 border-b border-[var(--surface-border)] last:border-0 hover:bg-black/20 transition-colors ${
                  e.isOwn ? "bg-[rgba(111,176,224,0.05)]" : ""
                }`}
              >
                <span className="font-mono text-sm text-[var(--text-muted)] w-6 shrink-0">{i + 1}</span>
                {e.isOwn ? (
                  <LogoMark size={40} />
                ) : (
                  <ManagerAvatar slug={e.slug} name={e.name} size={40} />
                )}
                <div className="min-w-0 flex-1">
                  <p className={`font-sans font-bold truncate ${e.isOwn ? "text-[var(--accent)]" : "text-[var(--text-primary)]"}`}>
                    {e.name}
                  </p>
                  <p className="text-xs text-[var(--text-secondary)] truncate">
                    {e.fund}
                    {!e.isOwn && e.coveragePct !== null && ` · ${e.coveragePct.toFixed(0)}% täckning`}
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
            Ingen data ännu för: {unranked.map((e) => e.name).join(", ")}.
          </p>
        )}
      </section>

      <Footer />
    </div>
  );
}
