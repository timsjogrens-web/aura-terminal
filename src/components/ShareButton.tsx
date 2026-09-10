"use client";

import { useState } from "react";

export default function ShareButton({ ticker }: { ticker: string }) {
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    const url = `${window.location.origin}/share/${ticker}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      window.open(url, "_blank");
    }
  }

  return (
    <button
      onClick={handleShare}
      title="Kopiera en delningslänk till denna signal"
      className="h-8 px-3 rounded-md border border-[var(--surface-border)] text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--gold)] hover:border-[var(--gold-dim)] transition flex items-center gap-1.5"
    >
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="18" cy="5" r="3" />
        <circle cx="6" cy="12" r="3" />
        <circle cx="18" cy="19" r="3" />
        <path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" strokeLinecap="round" />
      </svg>
      {copied ? "Kopierat!" : "Dela"}
    </button>
  );
}
