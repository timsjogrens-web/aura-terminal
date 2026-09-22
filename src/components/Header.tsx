"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQuotes } from "@/lib/useQuotes";
import { useNotificationPermission, useStrongBuyAlerts } from "@/lib/useAlerts";
import { useWatchlist } from "@/lib/WatchlistContext";
import { MAIN_LINKS } from "@/lib/navConfig";
import Sidebar from "./Sidebar";
import MobileNavDrawer from "./MobileNavDrawer";
import { LogoMark, Wordmark } from "./Logo";

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
          <LogoMark size={32} glow />
          <Wordmark className="text-base sm:text-lg" />
        </Link>

        <nav className="hidden sm:flex items-center gap-1 bg-black/30 rounded-lg p-1 border border-[var(--surface-border)]">
          {MAIN_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition flex items-center gap-2 shrink-0 whitespace-nowrap ${
                pathname === link.href
                  ? "bg-[var(--surface-2)] text-[var(--text-primary)]"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              {link.label}
              {link.href === "/watchlist" && watchlistCount !== null && (
                <span className="text-xs font-mono bg-[var(--gold)]/15 text-[var(--gold)] rounded-full px-1.5 py-0.5 min-w-[1.25rem] text-center">
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
              {isLive ? "Marknad live" : "Fördröjd data"}
            </span>
          </div>
          <button
            onClick={handleLogout}
            className="text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--gold)] border border-[var(--surface-border)] rounded-md px-3 py-1.5 transition"
          >
            Logga ut
          </button>
        </div>
      </div>
    </header>
    </>
  );
}
