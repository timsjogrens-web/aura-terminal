"use client";

import { Fragment, useMemo, useState } from "react";
import Link from "next/link";
import { Quote } from "@/lib/types";
import { formatPct, formatPrice } from "@/lib/format";
import Sparkline from "./Sparkline";
import SignalBadge from "./SignalBadge";
import WatchlistButton from "./WatchlistButton";

const SECTORS = ["ALL", "Technology", "Financials", "Healthcare", "Energy", "Consumer"];
const SIGNALS = ["ALL", "STRONG BUY", "BUY", "HOLD", "SELL", "STRONG SELL"];

export default function Screener({ quotes }: { quotes: Quote[] }) {
  const [query, setQuery] = useState("");
  const [sector, setSector] = useState("ALL");
  const [signal, setSignal] = useState("ALL");
  const [expanded, setExpanded] = useState<string | null>(null);

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

  return (
    <div className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] overflow-hidden">
      <div className="p-5 border-b border-[var(--surface-border)] flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="font-sans font-bold text-lg text-[var(--text-primary)] flex items-center gap-2">
            <svg viewBox="0 0 24 24" className="h-5 w-5 text-[var(--gold)]" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4-4" strokeLinecap="round" />
            </svg>
            Market Screener
          </h2>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search ticker or company"
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
              {s}
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
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs font-mono tracking-widest text-[var(--text-secondary)] border-b border-[var(--surface-border)]">
              <th className="px-5 py-3 font-medium">Ticker</th>
              <th className="px-5 py-3 font-medium">Price</th>
              <th className="px-5 py-3 font-medium">Change</th>
              <th className="px-5 py-3 font-medium hidden md:table-cell">30D</th>
              <th className="px-5 py-3 font-medium">Score</th>
              <th className="px-5 py-3 font-medium">Signal</th>
              <th className="px-5 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((q) => (
              <Fragment key={q.ticker}>
                <tr
                  onClick={() => setExpanded(expanded === q.ticker ? null : q.ticker)}
                  className="border-b border-[var(--surface-border)] hover:bg-black/20 cursor-pointer transition-colors"
                >
                  <td className="px-5 py-4">
                    <Link
                      href={`/stock/${q.ticker}`}
                      onClick={(e) => e.stopPropagation()}
                      className="font-mono font-semibold text-[var(--text-primary)] hover:text-[var(--gold)]"
                    >
                      {q.ticker}
                    </Link>
                    <p className="text-xs text-[var(--text-secondary)]">{q.company_name}</p>
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
                {expanded === q.ticker && (
                  <tr className="bg-black/20 border-b border-[var(--surface-border)]">
                    <td colSpan={7} className="px-5 py-4">
                      {q.error ? (
                        <p className="text-sm text-[var(--red)]">{q.error}</p>
                      ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-mono">
                          <div>
                            <p className="text-[var(--text-secondary)] mb-1">50D SMA</p>
                            <p className="text-[var(--text-primary)]">
                              {q.sma50 !== null ? `$${formatPrice(q.sma50)}` : "N/A"}
                            </p>
                          </div>
                          <div>
                            <p className="text-[var(--text-secondary)] mb-1">RSI(14)</p>
                            <p className="text-[var(--text-primary)]">
                              {q.rsi14 !== null ? q.rsi14.toFixed(1) : "N/A"}
                            </p>
                          </div>
                          <div>
                            <p className="text-[var(--text-secondary)] mb-1">Volume</p>
                            <p className="text-[var(--text-primary)]">
                              {q.volume !== null ? Math.round(q.volume).toLocaleString() : "N/A"}
                            </p>
                          </div>
                          <div>
                            <p className="text-[var(--text-secondary)] mb-1">Avg Volume (20D)</p>
                            <p className="text-[var(--text-primary)]">
                              {q.avg_volume !== null ? Math.round(q.avg_volume).toLocaleString() : "N/A"}
                            </p>
                          </div>
                        </div>
                      )}
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-10 text-center text-[var(--text-secondary)]">
                  No tickers match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
