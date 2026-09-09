"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQuotes } from "@/lib/useQuotes";
import { useNotificationPermission, useStrongBuyAlerts } from "@/lib/useAlerts";
import { useWatchlist } from "@/lib/WatchlistContext";
import Sidebar from "./Sidebar";

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { entries, loading: watchlistLoading } = useWatchlist();
  const watchlistCount = watchlistLoading ? null : entries.size;
  const { data } = useQuotes();
  const { permission, requestPermission } = useNotificationPermission();
  useStrongBuyAlerts(permission === "granted");

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const isLive = data && !data.isStale && data.apiKeyConfigured;

  return (
    <>
      <Sidebar />
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

        <nav className="hidden sm:flex items-center gap-1 bg-black/30 rounded-lg p-1 border border-[var(--surface-border)] flex-1 min-w-0 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <Link
            href="/"
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition shrink-0 whitespace-nowrap ${
              pathname === "/"
                ? "bg-[var(--surface-2)] text-[var(--text-primary)]"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            Markets
          </Link>
          <Link
            href="/watchlist"
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition flex items-center gap-2 shrink-0 whitespace-nowrap ${
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
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition shrink-0 whitespace-nowrap ${
              pathname === "/history"
                ? "bg-[var(--surface-2)] text-[var(--text-primary)]"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            History
          </Link>
          <Link
            href="/news"
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition shrink-0 whitespace-nowrap ${
              pathname === "/news"
                ? "bg-[var(--surface-2)] text-[var(--text-primary)]"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            News
          </Link>
        </nav>

        <div className="flex items-center gap-3 shrink-0">
          {permission !== "unsupported" && (
            <button
              onClick={requestPermission}
              disabled={permission !== "default"}
              title={
                permission === "granted"
                  ? "STRONG BUY alerts are on"
                  : permission === "denied"
                  ? "Notifications blocked in your browser settings"
                  : "Enable STRONG BUY alerts"
              }
              className={`h-8 w-8 rounded-md border flex items-center justify-center transition ${
                permission === "granted"
                  ? "border-[rgba(245,165,36,0.35)] text-[var(--gold)] bg-[rgba(245,165,36,0.08)]"
                  : "border-[var(--surface-border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:hover:text-[var(--text-secondary)]"
              }`}
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          )}
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

      <nav className="sm:hidden flex items-center gap-1 px-4 pb-3 -mt-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <Link
          href="/"
          className={`px-3 py-1.5 rounded-md text-xs font-medium shrink-0 whitespace-nowrap ${
            pathname === "/" ? "bg-[var(--surface-2)] text-[var(--text-primary)]" : "text-[var(--text-secondary)]"
          }`}
        >
          Markets
        </Link>
        <Link
          href="/watchlist"
          className={`px-3 py-1.5 rounded-md text-xs font-medium shrink-0 whitespace-nowrap ${
            pathname === "/watchlist" ? "bg-[var(--surface-2)] text-[var(--text-primary)]" : "text-[var(--text-secondary)]"
          }`}
        >
          Watchlist {watchlistCount !== null && `(${watchlistCount})`}
        </Link>
        <Link
          href="/history"
          className={`px-3 py-1.5 rounded-md text-xs font-medium shrink-0 whitespace-nowrap ${
            pathname === "/history" ? "bg-[var(--surface-2)] text-[var(--text-primary)]" : "text-[var(--text-secondary)]"
          }`}
        >
          History
        </Link>
        <Link
          href="/news"
          className={`px-3 py-1.5 rounded-md text-xs font-medium shrink-0 whitespace-nowrap ${
            pathname === "/news" ? "bg-[var(--surface-2)] text-[var(--text-primary)]" : "text-[var(--text-secondary)]"
          }`}
        >
          News
        </Link>
        <Link
          href="/investors"
          className={`px-3 py-1.5 rounded-md text-xs font-medium shrink-0 whitespace-nowrap ${
            pathname === "/investors" ? "bg-[var(--surface-2)] text-[var(--text-primary)]" : "text-[var(--text-secondary)]"
          }`}
        >
          Investors
        </Link>
        <Link
          href="/heatmap"
          className={`px-3 py-1.5 rounded-md text-xs font-medium shrink-0 whitespace-nowrap ${
            pathname === "/heatmap" ? "bg-[var(--surface-2)] text-[var(--text-primary)]" : "text-[var(--text-secondary)]"
          }`}
        >
          Heatmap
        </Link>
        <Link
          href="/paper"
          className={`px-3 py-1.5 rounded-md text-xs font-medium shrink-0 whitespace-nowrap ${
            pathname === "/paper" ? "bg-[var(--surface-2)] text-[var(--text-primary)]" : "text-[var(--text-secondary)]"
          }`}
        >
          Paper
        </Link>
        <Link
          href="/self-trade"
          className={`px-3 py-1.5 rounded-md text-xs font-medium shrink-0 whitespace-nowrap ${
            pathname === "/self-trade" ? "bg-[var(--surface-2)] text-[var(--text-primary)]" : "text-[var(--text-secondary)]"
          }`}
        >
          Self Trade
        </Link>
        <Link
          href="/insiders"
          className={`px-3 py-1.5 rounded-md text-xs font-medium shrink-0 whitespace-nowrap ${
            pathname === "/insiders" ? "bg-[var(--surface-2)] text-[var(--text-primary)]" : "text-[var(--text-secondary)]"
          }`}
        >
          Insiders
        </Link>
        <Link
          href="/backtest"
          className={`px-3 py-1.5 rounded-md text-xs font-medium shrink-0 whitespace-nowrap ${
            pathname === "/backtest" ? "bg-[var(--surface-2)] text-[var(--text-primary)]" : "text-[var(--text-secondary)]"
          }`}
        >
          Backtest
        </Link>
        <Link
          href="/leaderboard"
          className={`px-3 py-1.5 rounded-md text-xs font-medium shrink-0 whitespace-nowrap ${
            pathname === "/leaderboard" ? "bg-[var(--surface-2)] text-[var(--text-primary)]" : "text-[var(--text-secondary)]"
          }`}
        >
          Leaderboard
        </Link>
      </nav>
    </header>
    </>
  );
}
