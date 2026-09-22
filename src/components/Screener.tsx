"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Quote } from "@/lib/types";
import { formatPct, formatPrice } from "@/lib/format";
import Sparkline from "./Sparkline";
import SignalBadge from "./SignalBadge";
import WatchlistButton from "./WatchlistButton";
import CompanyLogo from "./CompanyLogo";

// Underlying values stay in English — they match the Sector type in
// universe.ts and the sector column stored in the database. Only the
// button labels shown to the user are translated.
const SECTORS = [
  "ALL",
  "Technology",
  "Financials",
  "Healthcare",
  "Energy",
  "Consumer",
  "Industrials",
  "Materials",
  "Utilities",
  "Real Estate",
  "Communication",
];
const SECTOR_LABELS: Record<string, string> = {
  ALL: "ALLA",
  Technology: "Teknik",
  Financials: "Finans",
  Healthcare: "Hälsovård",
  Energy: "Energi",
  Consumer: "Konsument",
  Industrials: "Industri",
  Materials: "Material",
  Utilities: "Allmännyttigt",
  "Real Estate": "Fastigheter",
  Communication: "Kommunikation",
};
const SIGNALS = ["ALL", "STRONG BUY", "BUY", "HOLD", "SELL", "STRONG SELL"];
const SIGNAL_LABELS: Record<string, string> = { ALL: "ALLA" };

// On mobile, the full list (up to all ~170 tracked stocks) meant an
// extremely long scroll before reaching anything below the screener —
// this caps the initial view and lets a "Visa alla" tap reveal the rest,
// same pattern as the buy-signal picker on the self-trade page.
const MOBILE_INITIAL_COUNT = 10;

export default function Screener({ quotes }: { quotes: Quote[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [sector, setSector] = useState("ALL");
  const [signal, setSignal] = useState("ALL");
  const [showAllMobile, setShowAllMobile] = useState(false);

  const filtered = useMemo(() => {
    return quotes.filter((q) => {
      if (sector !== "ALL" && q.sector !== sector) return false;
      if (signal !== "ALL" && q.signal !== signal) return false;
      if (query.trim()) {
        const needle = query.trim().toUpperCase();
        if (
          !q.ticker.toUpperCase().includes(needle) &&
          !(q.company_name ?? "").toUpperCase().includes(needle)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [quotes, sector, signal, query]);

  const visibleOnMobile = showAllMobile ? filtered : filtered.slice(0, MOBILE_INITIAL_COUNT);
  const hiddenOnMobileCount = filtered.length - visibleOnMobile.length;

  // Changing a filter with the long list already expanded would dump the
  // visitor right back into a huge scroll — collapse back to the short
  // view so a new filter always starts from the top.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShowAllMobile(false);
  }, [sector, signal, query]);

  return (
    <div className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] overflow-hidden">
      <div className="p-5 border-b border-[var(--surface-border)] flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="font-sans font-bold text-lg text-[var(--text-primary)] flex items-center gap-2">
            <svg viewBox="0 0 24 24" className="h-5 w-5 text-[var(--gold)]" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4-4" strokeLinecap="round" />
            </svg>
            Aktiescreener
          </h2>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Sök ticker eller bolag"
            className="w-full sm:w-64 rounded-md border border-[var(--surface-border)] bg-black/30 px-3 py-2 text-sm font-mono text-[var(--text-primary)] outline-none focus:border-[var(--gold)]"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {SECTORS.map((s) => (
            <button
              key={s}
              onClick={() => setSector(s)}
              className={`text-xs font-mono uppercase tracking-wide rounded px-3 py-1.5 border transition ${
                sector === s
                  ? "border-[var(--gold)] text-[var(--gold)] bg-[rgba(245,165,36,0.08)]"
                  : "border-[var(--surface-border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              {SECTOR_LABELS[s] ?? s}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {SIGNALS.map((s) => (
            <button
              key={s}
              onClick={() => setSignal(s)}
              className={`text-xs font-mono uppercase tracking-wide rounded px-3 py-1.5 border transition ${
                signal === s
                  ? "border-[var(--gold)] text-[var(--gold)] bg-[rgba(245,165,36,0.08)]"
                  : "border-[var(--surface-border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              {SIGNAL_LABELS[s] ?? s}
            </button>
          ))}
        </div>
      </div>

      <div className="sm:hidden divide-y divide-[var(--surface-border)]">
        {visibleOnMobile.map((q) => (
          <Link
            key={q.ticker}
            href={`/stock/${q.ticker}`}
            className="flex items-center gap-3 px-4 py-3 active:bg-black/20"
          >
            <CompanyLogo ticker={q.ticker} logoUrl={q.logo} size={32} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono font-semibold text-[var(--text-primary)]">{q.ticker}</span>
                <span className="font-mono text-[var(--text-primary)] whitespace-nowrap">
                  {q.price !== null ? `$${formatPrice(q.price)}` : "—"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 mt-1">
                <SignalBadge signal={q.signal} score={q.score} />
                <span
                  className={`font-mono text-xs whitespace-nowrap ${
                    (q.change_pct ?? 0) >= 0 ? "text-[var(--green)]" : "text-[var(--red)]"
                  }`}
                >
                  {formatPct(q.change_pct)}
                </span>
              </div>
            </div>
          </Link>
        ))}
        {filtered.length === 0 && (
          <p className="px-4 py-10 text-center text-[var(--text-secondary)]">Inga aktier matchar dessa filter.</p>
        )}
        {hiddenOnMobileCount > 0 && (
          <button
            onClick={() => setShowAllMobile(true)}
            className="w-full py-3.5 text-sm font-medium text-[var(--gold)] hover:bg-black/20 active:bg-black/30 transition"
          >
            Visa alla ({filtered.length} aktier)
          </button>
        )}
        {showAllMobile && filtered.length > MOBILE_INITIAL_COUNT && (
          <button
            onClick={() => setShowAllMobile(false)}
            className="w-full py-3.5 text-sm font-medium text-[var(--text-secondary)] hover:bg-black/20 active:bg-black/30 transition"
          >
            Visa färre
          </button>
        )}
      </div>

      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs font-mono tracking-widest text-[var(--text-secondary)] border-b border-[var(--surface-border)]">
              <th className="px-5 py-3 font-medium">Ticker</th>
              <th className="px-5 py-3 font-medium">Pris</th>
              <th className="px-5 py-3 font-medium">Förändring</th>
              <th className="px-5 py-3 font-medium hidden md:table-cell">30D</th>
              <th className="px-5 py-3 font-medium">Poäng</th>
              <th className="px-5 py-3 font-medium">Signal</th>
              <th className="px-5 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((q) => (
              <tr
                key={q.ticker}
                onClick={() => router.push(`/stock/${q.ticker}`)}
                className="border-b border-[var(--surface-border)] hover:bg-black/20 cursor-pointer transition-colors"
              >
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2.5">
                      <CompanyLogo ticker={q.ticker} logoUrl={q.logo} size={24} />
                      <div>
                        <Link
                          href={`/stock/${q.ticker}`}
                          onClick={(e) => e.stopPropagation()}
                          className="font-mono font-semibold text-[var(--text-primary)] hover:text-[var(--gold)]"
                        >
                          {q.ticker}
                        </Link>
                        <p className="text-xs text-[var(--text-secondary)]">{q.company_name}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4 font-mono text-[var(--text-primary)] whitespace-nowrap">
                    {q.price !== null ? `$${formatPrice(q.price)}` : "—"}
                  </td>
                  <td
                    className={`px-5 py-4 font-mono whitespace-nowrap ${
                      (q.change_pct ?? 0) >= 0 ? "text-[var(--green)]" : "text-[var(--red)]"
                    }`}
                  >
                    {formatPct(q.change_pct)}
                  </td>
                  <td className="px-5 py-4 hidden md:table-cell">
                    <Sparkline data={q.sparkline} width={100} height={30} />
                  </td>
                  <td className="px-5 py-4">
                    {q.score !== null ? (
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[var(--text-primary)] w-6">{q.score}</span>
                        <div className="w-20 h-1.5 rounded-full bg-black/30 overflow-hidden hidden lg:block">
                          <div
                            className="h-full bg-[var(--gold)]"
                            style={{ width: `${q.score}%` }}
                          />
                        </div>
                      </div>
                    ) : (
                      <span className="text-[var(--text-muted)]">—</span>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <SignalBadge signal={q.signal} score={null} />
                  </td>
                  <td className="px-5 py-4" onClick={(e) => e.stopPropagation()}>
                    <WatchlistButton
                      ticker={q.ticker}
                      companyName={q.company_name ?? undefined}
                      sector={q.sector ?? undefined}
                    />
                  </td>
                </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-10 text-center text-[var(--text-secondary)]">
                  Inga aktier matchar dessa filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
