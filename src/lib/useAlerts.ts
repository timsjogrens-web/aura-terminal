"use client";

import { useEffect, useState, useCallback } from "react";

const LAST_SEEN_KEY = "aura_alerts_last_seen_id";

export type NotificationPermissionState = "default" | "granted" | "denied" | "unsupported";

export function useNotificationPermission() {
  const [permission, setPermission] = useState<NotificationPermissionState>("default");

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setPermission("unsupported");
      return;
    }
    setPermission(Notification.permission as NotificationPermissionState);
  }, []);

  const requestPermission = useCallback(async () => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    const result = await Notification.requestPermission();
    setPermission(result as NotificationPermissionState);
  }, []);

  return { permission, requestPermission };
}

interface AlertRow {
  id: number;
  ticker: string;
  score: number | null;
  price: number | null;
  timestamp: string;
}

// Polls for tickers that just flipped to STRONG BUY and fires a browser
// notification for each. Runs only once permission has been granted; the
// very first poll just establishes a baseline so we never notify about
// transitions that happened before alerts were turned on.
export function useStrongBuyAlerts(enabled: boolean, pollMs = 60000) {
  useEffect(() => {
    if (!enabled || typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission !== "granted") return;

    let cancelled = false;

    async function poll() {
      try {
        const stored = localStorage.getItem(LAST_SEEN_KEY);
        if (stored === null) {
          const res = await fetch("/api/alerts?sinceId=0");
          const json = await res.json();
          if (!cancelled) localStorage.setItem(LAST_SEEN_KEY, String(json.latestId ?? 0));
          return;
        }

        const res = await fetch(`/api/alerts?sinceId=${stored}`);
        const json = (await res.json()) as { alerts: AlertRow[]; latestId: number };
        if (cancelled) return;

        for (const a of json.alerts) {
          const priceText = a.price !== null ? `$${a.price.toFixed(2)}` : "";
          new Notification(`${a.ticker} just hit STRONG BUY`, {
            body: `Score ${a.score ?? "—"} at ${priceText}`.trim(),
            tag: `aura-alert-${a.id}`,
          });
        }

        localStorage.setItem(LAST_SEEN_KEY, String(json.latestId));
      } catch {
        // network hiccups just get retried on the next poll
      }
    }

    poll();
    const id = setInterval(poll, pollMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [enabled, pollMs]);
}
