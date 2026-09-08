"use client";

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";

export interface WatchlistEntry {
  ticker: string;
  company_name: string | null;
  sector: string | null;
  added_at: string;
}

interface WatchlistContextValue {
  entries: Map<string, WatchlistEntry>;
  loading: boolean;
  add: (ticker: string, companyName?: string, sector?: string) => Promise<{ ok: boolean; error?: string }>;
  remove: (ticker: string) => Promise<void>;
  reload: () => void;
}

const WatchlistContext = createContext<WatchlistContextValue | null>(null);

export function WatchlistProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<Map<string, WatchlistEntry>>(new Map());
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    fetch("/api/watchlist")
      .then((r) => r.json())
      .then((json) => {
        const list = (json.watchlist ?? []) as WatchlistEntry[];
        setEntries(new Map(list.map((w) => [w.ticker, w])));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const add = useCallback(
    async (ticker: string, companyName?: string, sector?: string) => {
      setEntries((prev) => {
        const next = new Map(prev);
        next.set(ticker, {
          ticker,
          company_name: companyName ?? ticker,
          sector: sector ?? null,
          added_at: new Date().toISOString(),
        });
        return next;
      });

      const res = await fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker }),
      });
      const json = await res.json();

      if (!res.ok) {
        setEntries((prev) => {
          const next = new Map(prev);
          next.delete(ticker);
          return next;
        });
        return { ok: false, error: json.error as string };
      }

      setEntries((prev) => {
        const next = new Map(prev);
        next.set(ticker, {
          ticker,
          company_name: json.name ?? companyName ?? ticker,
          sector: json.sector ?? sector ?? null,
          added_at: new Date().toISOString(),
        });
        return next;
      });
      return { ok: true };
    },
    []
  );

  const remove = useCallback(async (ticker: string) => {
    setEntries((prev) => {
      const next = new Map(prev);
      next.delete(ticker);
      return next;
    });
    await fetch("/api/watchlist", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticker }),
    }).catch(() => {});
  }, []);

  return (
    <WatchlistContext.Provider value={{ entries, loading, add, remove, reload: load }}>
      {children}
    </WatchlistContext.Provider>
  );
}

export function useWatchlist() {
  const ctx = useContext(WatchlistContext);
  if (!ctx) throw new Error("useWatchlist must be used within a WatchlistProvider");
  return ctx;
}
