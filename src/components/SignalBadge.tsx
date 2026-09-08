const STYLES: Record<string, string> = {
  "STRONG BUY": "bg-[rgba(34,197,94,0.12)] text-[var(--green)] border-[rgba(34,197,94,0.35)]",
  BUY: "bg-[rgba(34,197,94,0.08)] text-[var(--green)] border-[rgba(34,197,94,0.25)]",
  HOLD: "bg-[rgba(245,165,36,0.1)] text-[var(--gold)] border-[rgba(245,165,36,0.3)]",
  SELL: "bg-[rgba(239,68,68,0.08)] text-[var(--red)] border-[rgba(239,68,68,0.25)]",
  "STRONG SELL": "bg-[rgba(239,68,68,0.12)] text-[var(--red)] border-[rgba(239,68,68,0.35)]",
};

export default function SignalBadge({
  signal,
  score,
}: {
  signal: string | null;
  score: number | null;
}) {
  if (!signal) {
    return (
      <span className="text-xs font-mono text-[var(--text-muted)] border border-[var(--surface-border)] rounded px-2 py-1">
        N/A
      </span>
    );
  }
  const style = STYLES[signal] ?? STYLES.HOLD;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded border px-2.5 py-1 text-xs font-mono font-semibold tracking-wide whitespace-nowrap ${style}`}
    >
      {signal}
      {score !== null && <span className="opacity-70">{score}%</span>}
    </span>
  );
}
