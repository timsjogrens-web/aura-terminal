"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuotes } from "@/lib/useQuotes";
import { useNotificationPermission, useStrongBuyAlerts } from "@/lib/useAlerts";
import { useWatchlist } from "@/lib/WatchlistContext";
import { useAuthStatus } from "@/lib/useAuthStatus";
import { MAIN_LINKS } from "@/lib/navConfig";
import Sidebar from "./Sidebar";
import MobileNavDrawer from "./MobileNavDrawer";
import { LogoMark, Wordmark } from "./Logo";

export default function Header() {
  const pathname = usePathname();
  const { entries, loading: watchlistLoading } = useWatchlist();
  const watchlistCount = watchlistLoading ? null : entries.size;
  const { data } = useQuotes();
  const { permission, requestPermission } = useNotificationPermission();
  useStrongBuyAlerts(permission === "granted");
  const auth = useAuthStatus();
  const loggedIn = auth ? auth.loggedIn : null;

  const isLive = data && !data.isStale && data.apiKeyConfigured;

  return (
    <>
      <Sidebar />
      <header className="border-b border-[var(--surface-border)] bg-[var(--surface)]/60 backdrop-blur sticky top-0 z-30">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-3.5 flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2.5 shrink-0">
          <LogoMark size={32} glow />
          <Wordmark className="text-base sm:text-lg" />
        </Link>

        <nav className="hidden sm:flex items-center gap-1 bg-black/30 rounded-lg p-1 border border-[var(--surface-border)]">
          {MAIN_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`px-2.5 xl:px-4 py-1.5 rounded-md text-sm font-medium transition flex items-center gap-2 shrink-0 whitespace-nowrap ${
                pathname === link.href
                  ? "bg-[var(--surface-2)] text-[var(--text-primary)]"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              {link.label}
              {link.href === "/watchlist" && watchlistCount !== null && (
                <span className="text-xs font-mono bg-[var(--accent)]/15 text-[var(--accent)] rounded-full px-1.5 py-0.5 min-w-[1.25rem] text-center">
                  {watchlistCount}
                </span>
              )}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3 shrink-0">
          <MobileNavDrawer watchlistCount={watchlistCount} />
          {permission !== "unsupported" && (
            <button
              onClick={requestPermission}
              disabled={permission !== "default"}
              title={
                permission === "granted"
                  ? "STRONG BUY-aviseringar är på"
                  : permission === "denied"
                  ? "Aviseringar blockerade i din webbläsare"
                  : "Aktivera STRONG BUY-aviseringar"
              }
              className={`h-8 w-8 rounded-md border flex items-center justify-center transition ${
                permission === "granted"
                  ? "border-[rgba(111,176,224,0.35)] text-[var(--accent)] bg-[rgba(111,176,224,0.08)]"
                  : "border-[var(--surface-border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:hover:text-[var(--text-secondary)]"
              }`}
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          )}
          {/* xl, not md — with the 208px sidebar open and logged in (the
              "Mitt konto" pill also competing for room), this badge plus
              the 5 nav links stopped fitting right around 1024-1279px and
              forced the whole page to scroll sideways instead of just
              this row. */}
          <div className="hidden xl:flex items-center gap-2 text-xs font-mono uppercase tracking-wider">
            <span
              className={`h-2 w-2 rounded-full ${
                isLive ? "bg-[var(--green)] animate-pulse-dot" : "bg-[var(--red)]"
              }`}
            />
            <span className={isLive ? "text-[var(--text-secondary)]" : "text-[var(--red)]"}>
              {isLive ? "Marknad live" : "Fördröjd data"}
            </span>
          </div>
          {loggedIn === true && (
            <Link
              href="/account"
              title={auth?.email ?? undefined}
              className="flex items-center gap-1.5 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--accent)] border border-[var(--surface-border)] rounded-md px-3 py-1.5 transition"
            >
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="8" r="4" />
                <path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" strokeLinecap="round" />
              </svg>
              <span className="hidden xl:inline">Mitt konto</span>
            </Link>
          )}
          {loggedIn === false && (
            <Link
              href="/login"
              className="text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--accent)] border border-[var(--surface-border)] rounded-md px-3 py-1.5 transition"
            >
              Logga in
            </Link>
          )}
        </div>
      </div>
    </header>
    </>
  );
}
