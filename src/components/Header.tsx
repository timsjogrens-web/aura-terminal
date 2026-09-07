"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useQuotes } from "@/lib/useQuotes";

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const [watchlistCount, setWatchlistCount] = useState<number | null>(null);
  const { data } = useQuotes();

  useEffect(() => {
    let cancelled = false;
    fetch("/api/watchlist")
      .then((r) => r.json())
      .then((json) => {
        if (!cancelled) setWatchlistCount(json.watchlist?.length ?? 0);
      })
      .catch(() => {});
    const id = setInterval(() => {
      fetch("/api/watchlist")
        .then((r) => r.json())
        .then((json) => {
          if (!cancelled) setWatchlistCount(json.watchlist?.length ?? 0);
        })
        .catch(() => {});
    }, 30000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const isLive = data && !data.isStale && data.apiKeyConfigured;

  return (
    <header className="border-b border-[var(--surface-border)] bg-[var(--surface)]/60 backdrop-blur sticky top-0 z-30">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-3.5 flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2.5 shrink-0">
          <div className="h-8 w-8 rounded-md bg-[var(--gold)] flex items-center justify-center shadow-[0_0_14px_rgba(245,165,36,0.35)]">
            <svg viewBox="0 0 24 24" className="h-4.5 w-4.5 text-black" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M2 12h4l3 8 4-16 3 8h4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <span className="font-sans font-bold tracking-wide text-base sm:text-lg whitespace-nowrap">
            <span className="text-[var(--text-primary)]">AURA</span>{" "}
            <span className="text-[var(--gold)]">TERMINAL</span>
          </span>
        </Link>

        <nav className="hidden sm:flex items-center gap-1 bg-black/30 rounded-lg p-1 border border-[var(--surface-border)]">
          <Link
            href="/"
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${
              pathname === "/"
                ? "bg-[var(--surface-2)] text-[var(--text-primary)]"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            Markets
          </Link>
          <Link
            href="/watchlist"
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition flex items-center gap-2 ${
              pathname === "/watchlist"
                ? "bg-[var(--surface-2)] text-[var(--text-primary)]"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            Watchlist
            {watchlistCount !== null && (
              <span className="text-xs font-mono bg-[var(--gold)]/15 text-[var(--gold)] rounded-full px-1.5 py-0.5 min-w-[1.25rem] text-center">
                {watchlistCount}
              </span>
            )}
          </Link>
          <Link
            href="/history"
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${
              pathname === "/history"
                ? "bg-[var(--surface-2)] text-[var(--text-primary)]"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            History
          </Link>
        </nav>

        <div className="flex items-center gap-3 shrink-0">
          <div className="hidden md:flex items-center gap-2 text-xs font-mono uppercase tracking-wider">
            <span
              className={`h-2 w-2 rounded-full ${
                isLive ? "bg-[var(--green)] animate-pulse-dot" : "bg-[var(--red)]"
              }`}
            />
            <span className={isLive ? "text-[var(--text-secondary)]" : "text-[var(--red)]"}>
              {isLive ? "Market Live" : "Data Delayed"}
            </span>
          </div>
          <button
            onClick={handleLogout}
            className="text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--gold)] border border-[var(--surface-border)] rounded-md px-3 py-1.5 transition"
          >
            Log out
          </button>
        </div>
      </div>

      <nav className="sm:hidden flex items-center gap-1 px-4 pb-3 -mt-1">
        <Link
          href="/"
          className={`px-3 py-1.5 rounded-md text-xs font-medium ${
            pathname === "/" ? "bg-[var(--surface-2)] text-[var(--text-primary)]" : "text-[var(--text-secondary)]"
          }`}
        >
          Markets
        </Link>
        <Link
          href="/watchlist"
          className={`px-3 py-1.5 rounded-md text-xs font-medium ${
            pathname === "/watchlist" ? "bg-[var(--surface-2)] text-[var(--text-primary)]" : "text-[var(--text-secondary)]"
          }`}
        >
          Watchlist {watchlistCount !== null && `(${watchlistCount})`}
        </Link>
        <Link
          href="/history"
          className={`px-3 py-1.5 rounded-md text-xs font-medium ${
            pathname === "/history" ? "bg-[var(--surface-2)] text-[var(--text-primary)]" : "text-[var(--text-secondary)]"
          }`}
        >
          History
        </Link>
      </nav>
    </header>
  );
}
