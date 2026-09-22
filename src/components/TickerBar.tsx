"use client";

import { Quote } from "@/lib/types";
import { formatPrice, formatPct } from "@/lib/format";
import CompanyLogo from "./CompanyLogo";

function Item({ q }: { q: Quote }) {
  const up = (q.change_pct ?? 0) >= 0;
  return (
    <div className="flex items-center gap-2 px-5 py-2.5 shrink-0 font-mono text-sm whitespace-nowrap">
      <CompanyLogo ticker={q.ticker} logoUrl={q.logo} size={16} />
      <span className="text-[var(--text-primary)] font-semibold">{q.ticker}</span>
      <span className="text-[var(--text-secondary)]">
        {q.price !== null ? `$${formatPrice(q.price)}` : "—"}
      </span>
      {q.change_pct !== null ? (
        <span className={`flex items-center gap-1 ${up ? "text-[var(--green)]" : "text-[var(--red)]"}`}>
          <svg viewBox="0 0 10 10" className="h-2.5 w-2.5" fill="currentColor">
            {up ? <path d="M5 1l4 8H1z" /> : <path d="M5 9L1 1h8z" />}
          </svg>
          {formatPct(q.change_pct)}
        </span>
      ) : (
        <span className="text-[var(--text-muted)]">n/a</span>
      )}
    </div>
  );
}

// Keep the scroll speed (px/sec) constant no matter how many stocks are
// tracked — duration scales with item count instead of being a fixed
// seconds value, so growing the universe doesn't speed up the ticker.
const SECONDS_PER_ITEM = 1.1;
const MIN_DURATION_S = 30;

export default function TickerBar({ quotes }: { quotes: Quote[] }) {
  const withPrices = quotes.filter((q) => q.price !== null);
  if (withPrices.length === 0) return null;

  const doubled = [...withPrices, ...withPrices];
  const durationS = Math.max(MIN_DURATION_S, withPrices.length * SECONDS_PER_ITEM);

  return (
    <div className="border-b border-[var(--surface-border)] bg-[var(--surface)] overflow-hidden">
      <div
        className="flex animate-ticker w-max divide-x divide-[var(--surface-border)]"
        style={{ animationDuration: `${durationS}s` }}
      >
        {doubled.map((q, i) => (
          <Item key={`${q.ticker}-${i}`} q={q} />
        ))}
      </div>
    </div>
  );
}
