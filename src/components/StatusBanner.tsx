"use client";

import { useState } from "react";
import { QuotesResponse } from "@/lib/types";
import { formatClock, timeAgo } from "@/lib/format";

export default function StatusBanner({
  data,
  fetchError,
  onRefresh,
}: {
  data: QuotesResponse | null;
  fetchError: string | null;
  onRefresh: () => void;
}) {
  const [refreshing, setRefreshing] = useState(false);

  async function handleManualRefresh() {
    setRefreshing(true);
    try {
      const res = await fetch("/api/refresh", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Refresh failed");
      onRefresh();
    } catch {
      // surfaced via the banner state on next poll
    } finally {
      setRefreshing(false);
    }
  }

  if (fetchError) {
    return (
      <div className="mx-auto max-w-7xl px-4 sm:px-6 mb-6">
        <div className="rounded-lg border border-[rgba(239,68,68,0.35)] bg-[rgba(239,68,68,0.08)] px-4 py-3 text-sm text-[var(--red)] flex items-center justify-between gap-3 flex-wrap">
          <span>Could not load data from the server: {fetchError}</span>
          <button
            onClick={handleManualRefresh}
            className="text-xs font-mono border border-[rgba(239,68,68,0.4)] rounded px-2 py-1 hover:bg-[rgba(239,68,68,0.15)]"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  if (!data.apiKeyConfigured) {
    return (
      <div className="mx-auto max-w-7xl px-4 sm:px-6 mb-6">
        <div className="rounded-lg border border-[rgba(245,165,36,0.35)] bg-[rgba(245,165,36,0.08)] px-4 py-3 text-sm text-[var(--gold)]">
          FINNHUB_API_KEY is not configured. Add it to <code className="font-mono">.env.local</code> and
          restart the server to enable live data. No prices are being shown until this is set.
        </div>
      </div>
    );
  }

  const anyErrors = data.quotes.some((q) => q.error);

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 mb-6 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3 text-xs font-mono text-[var(--text-secondary)]">
        <span>
          Last updated{" "}
          <span className="text-[var(--text-primary)]">
            {data.lastRefresh ? formatClock(data.lastRefresh) : "never"}
          </span>{" "}
          ({timeAgo(data.lastRefresh)})
        </span>
        {data.isStale && (
          <span className="rounded border border-[rgba(245,165,36,0.35)] bg-[rgba(245,165,36,0.1)] text-[var(--gold)] px-2 py-0.5">
            DELAYED &middot; refresh runs every {data.staleThresholdMinutes}min
          </span>
        )}
        {anyErrors && (
          <span className="rounded border border-[rgba(239,68,68,0.35)] bg-[rgba(239,68,68,0.08)] text-[var(--red)] px-2 py-0.5">
            Some tickers failed to update
          </span>
        )}
      </div>
      <button
        onClick={handleManualRefresh}
        disabled={refreshing}
        className="text-xs font-mono border border-[var(--surface-border)] rounded px-3 py-1.5 text-[var(--text-secondary)] hover:text-[var(--gold)] hover:border-[var(--gold-dim)] transition disabled:opacity-50"
      >
        {refreshing ? "Refreshing…" : "Refresh now"}
      </button>
    </div>
  );
}
