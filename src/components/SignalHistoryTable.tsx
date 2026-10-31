"use client";

import { useMemo, useState } from "react";
import { formatPrice } from "@/lib/format";
import SignalBadge from "./SignalBadge";

export interface HistoryEntry {
  id: number;
  ticker: string;
  score: number | null;
  signal: string | null;
  price: number | null;
  timestamp: string;
  nextPrice: number | null;
  nextTimestamp: string | null;
  outcome: "hit" | "miss" | null;
}

const FILTERS = ["ALL", "STRONG BUY", "BUY", "HOLD", "SELL", "STRONG SELL"];

export default function SignalHistoryTable({
  rows,
  hitRate,
  evaluated,
  title,
  defaultFilter = "ALL",
}: {
  rows: HistoryEntry[];
  hitRate: number | null;
  evaluated: number;
  title?: string;
  defaultFilter?: string;
}) {
  const [filter, setFilter] = useState(defaultFilter);

  const filteredRows = useMemo(
    () => (filter === "ALL" ? rows : rows.filter((r) => r.signal === filter)),
    [rows, filter]
  );

  const { displayHitRate, displayEvaluated } = useMemo(() => {
    if (filter === "ALL") return { displayHitRate: hitRate, displayEvaluated: evaluated };
    const hits = filteredRows.filter((r) => r.outcome === "hit").length;
    const scored = filteredRows.filter((r) => r.outcome !== null).length;
    return {
      displayHitRate: scored > 0 ? Math.round((hits / scored) * 100) : null,
      displayEvaluated: scored,
    };
  }, [filter, filteredRows, hitRate, evaluated]);

  if (rows.length === 0) {
    return (
      <div className="p-8 text-center text-[var(--text-secondary)] text-sm">
        Ingen signalhistorik registrerad ännu för denna aktie.
      </div>
    );
  }

  return (
    <>
      <div className="p-4 border-b border-[var(--surface-border)]">
        <div className="flex items-center justify-between mb-3">
          <p className="font-mono font-bold text-[var(--text-primary)]">{title ?? "Historik"}</p>
          <p className="text-sm font-mono text-[var(--text-secondary)]">
            Träffsäkerhet: {displayHitRate !== null ? `${displayHitRate}%` : "—"} ({displayEvaluated} utvärderade)
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-xs font-mono uppercase tracking-wide rounded px-2.5 py-1 border transition ${
                filter === f
                  ? "border-[var(--accent)] text-[var(--accent)] bg-[rgba(111,176,224,0.08)]"
                  : "border-[var(--surface-border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>
      {filteredRows.length === 0 ? (
        <div className="p-8 text-center text-[var(--text-secondary)] text-sm">
          Inga {filter}-signaler registrerade för denna aktie ännu.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-mono tracking-widest text-[var(--text-secondary)] border-b border-[var(--surface-border)]">
                <th className="px-4 py-2.5">Tidpunkt</th>
                <th className="px-4 py-2.5">Signal</th>
                <th className="px-4 py-2.5">Poäng</th>
                <th className="px-4 py-2.5">Pris</th>
                <th className="px-4 py-2.5">Nästa pris</th>
                <th className="px-4 py-2.5">Utfall</th>
              </tr>
            </thead>
            <tbody>
              {[...filteredRows].reverse().map((r) => (
                <tr
                  key={r.id}
                  className={`border-b border-[var(--surface-border)] ${
                    r.signal === "STRONG BUY" ? "bg-[rgba(34,197,94,0.05)]" : ""
                  }`}
                >
                  <td className="px-4 py-2.5 font-mono text-xs text-[var(--text-secondary)]">
                    {new Date(r.timestamp).toLocaleString()}
                  </td>
                  <td className="px-4 py-2.5">
                    <SignalBadge signal={r.signal} score={null} />
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs">{r.score ?? "—"}</td>
                  <td className="px-4 py-2.5 font-mono text-xs">
                    {r.price !== null ? `$${formatPrice(r.price)}` : "—"}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs">
                    {r.nextPrice !== null ? `$${formatPrice(r.nextPrice)}` : "—"}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs">
                    {r.outcome === "hit" && <span className="text-[var(--green)]">TRÄFF</span>}
                    {r.outcome === "miss" && <span className="text-[var(--red)]">MISS</span>}
                    {!r.outcome && <span className="text-[var(--text-muted)]">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
