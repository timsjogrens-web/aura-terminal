"use client";

import { useEffect, useState, useCallback } from "react";
import { QuotesResponse } from "./types";

export function useQuotes(pollMs = 60000) {
  const [data, setData] = useState<QuotesResponse | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/quotes");
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      const json = (await res.json()) as QuotesResponse;
      setData(json);
      setFetchError(null);
    } catch (e) {
      setFetchError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, pollMs);
    return () => clearInterval(id);
  }, [load, pollMs]);

  return { data, fetchError, loading, reload: load };
}
