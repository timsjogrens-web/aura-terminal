"use client";

import { useState } from "react";
import { useWatchlist } from "@/lib/WatchlistContext";

export default function WatchlistButton({
  ticker,
  companyName,
  sector,
  className = "",
}: {
  ticker: string;
  companyName?: string;
  sector?: string;
  className?: string;
}) {
  const { entries, add, remove } = useWatchlist();
  const [busy, setBusy] = useState(false);
  const isWatched = entries.has(ticker);

  async function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    setBusy(true);
    if (isWatched) {
      await remove(ticker);
    } else {
      await add(ticker, companyName, sector);
    }
    setBusy(false);
  }

  return (
    <button
      onClick={handleClick}
      disabled={busy}
      title={isWatched ? `Ta bort ${ticker} från bevakningslistan` : `Lägg till ${ticker} i bevakningslistan`}
      className={`h-7 w-7 shrink-0 rounded-md border flex items-center justify-center transition disabled:opacity-50 ${
        isWatched
          ? "border-[rgba(245,165,36,0.4)] bg-[rgba(245,165,36,0.1)] text-[var(--gold)]"
          : "border-[var(--surface-border)] text-[var(--text-secondary)] hover:text-[var(--gold)] hover:border-[var(--gold-dim)]"
      } ${className}`}
    >
      <svg
        viewBox="0 0 24 24"
        className="h-4 w-4"
        fill={isWatched ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="2"
      >
        <path
          d="M12 2.5l3.09 6.26 6.91 1-5 4.87 1.18 6.88L12 18.27l-6.18 3.25L7 14.63l-5-4.87 6.91-1L12 2.5z"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
