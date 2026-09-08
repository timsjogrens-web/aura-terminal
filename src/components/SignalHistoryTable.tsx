import { formatPrice } from "@/lib/format";

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

export default function SignalHistoryTable({
  rows,
  hitRate,
  evaluated,
  title,
}: {
  rows: HistoryEntry[];
  hitRate: number | null;
  evaluated: number;
  title?: string;
}) {
  if (rows.length === 0) {
    return (
      <div className="p-8 text-center text-[var(--text-secondary)] text-sm">
        No signal history recorded yet for this ticker.
      </div>
    );
  }

  return (
    <>
      <div className="p-4 border-b border-[var(--surface-border)] flex items-center justify-between">
        <p className="font-mono font-bold text-[var(--text-primary)]">{title ?? "History"}</p>
        <p className="text-sm font-mono text-[var(--text-secondary)]">
          Hit rate: {hitRate !== null ? `${hitRate}%` : "—"} ({evaluated} scored)
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs font-mono tracking-widest text-[var(--text-secondary)] border-b border-[var(--surface-border)]">
              <th className="px-4 py-2.5">Timestamp</th>
              <th className="px-4 py-2.5">Signal</th>
              <th className="px-4 py-2.5">Score</th>
              <th className="px-4 py-2.5">Price</th>
              <th className="px-4 py-2.5">Next Price</th>
              <th className="px-4 py-2.5">Outcome</th>
            </tr>
          </thead>
          <tbody>
            {[...rows].reverse().map((r) => (
              <tr key={r.id} className="border-b border-[var(--surface-border)]">
                <td className="px-4 py-2.5 font-mono text-xs text-[var(--text-secondary)]">
                  {new Date(r.timestamp).toLocaleString()}
                </td>
                <td className="px-4 py-2.5 font-mono text-xs">{r.signal ?? "—"}</td>
                <td className="px-4 py-2.5 font-mono text-xs">{r.score ?? "—"}</td>
                <td className="px-4 py-2.5 font-mono text-xs">
                  {r.price !== null ? `$${formatPrice(r.price)}` : "—"}
                </td>
                <td className="px-4 py-2.5 font-mono text-xs">
                  {r.nextPrice !== null ? `$${formatPrice(r.nextPrice)}` : "—"}
                </td>
                <td className="px-4 py-2.5 font-mono text-xs">
                  {r.outcome === "hit" && <span className="text-[var(--green)]">HIT</span>}
                  {r.outcome === "miss" && <span className="text-[var(--red)]">MISS</span>}
                  {!r.outcome && <span className="text-[var(--text-muted)]">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
