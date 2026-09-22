"use client";

import { useState } from "react";
import { QuotesResponse } from "@/lib/types";
import { formatClock, timeAgo } from "@/lib/format";
import { useAuthStatus } from "@/lib/useAuthStatus";

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
  const auth = useAuthStatus();
  // Forcing a global refresh stays admin-only (see StatusBanner in proxy.ts's comment).
  const loggedIn = auth ? auth.isAdmin : null;

  async function handleManualRefresh() {
    setRefreshing(true);
    try {
      const res = await fetch("/api/refresh", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Uppdatering misslyckades");
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
          <span>Kunde inte hämta data från servern: {fetchError}</span>
          {loggedIn === true && (
            <button
              onClick={handleManualRefresh}
              className="text-xs font-mono border border-[rgba(239,68,68,0.4)] rounded px-2 py-1 hover:bg-[rgba(239,68,68,0.15)]"
            >
              Försök igen
            </button>
          )}
        </div>
      </div>
    );
  }

  if (!data) return null;

  if (!data.apiKeyConfigured) {
    return (
      <div className="mx-auto max-w-7xl px-4 sm:px-6 mb-6">
        <div className="rounded-lg border border-[rgba(245,165,36,0.35)] bg-[rgba(245,165,36,0.08)] px-4 py-3 text-sm text-[var(--gold)]">
          FINNHUB_API_KEY är inte konfigurerad. Lägg till den i <code className="font-mono">.env.local</code> och
          starta om servern för att aktivera livedata. Inga priser visas förrän detta är gjort.
        </div>
      </div>
    );
  }

  const anyErrors = data.quotes.some((q) => q.error);

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 mb-6 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3 text-xs font-mono text-[var(--text-secondary)]">
        <span>
          Senast uppdaterad{" "}
          <span className="text-[var(--text-primary)]">
            {data.lastRefresh ? formatClock(data.lastRefresh) : "aldrig"}
          </span>{" "}
          ({timeAgo(data.lastRefresh)})
        </span>
        {data.isStale && (
          <span className="rounded border border-[rgba(245,165,36,0.35)] bg-[rgba(245,165,36,0.1)] text-[var(--gold)] px-2 py-0.5">
            FÖRDRÖJD &middot; uppdateras var {data.staleThresholdMinutes}:e minut
          </span>
        )}
        {anyErrors && (
          <span className="rounded border border-[rgba(239,68,68,0.35)] bg-[rgba(239,68,68,0.08)] text-[var(--red)] px-2 py-0.5">
            Vissa aktier kunde inte uppdateras
          </span>
        )}
      </div>
      {loggedIn === true && (
        <button
          onClick={handleManualRefresh}
          disabled={refreshing}
          className="text-xs font-mono border border-[var(--surface-border)] rounded px-3 py-1.5 text-[var(--text-secondary)] hover:text-[var(--gold)] hover:border-[var(--gold-dim)] transition disabled:opacity-50"
        >
          {refreshing ? "Uppdaterar…" : "Uppdatera nu"}
        </button>
      )}
    </div>
  );
}
