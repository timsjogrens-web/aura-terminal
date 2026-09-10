"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MAIN_LINKS, SIDEBAR_GROUPS } from "@/lib/navConfig";

// Replaces the old horizontal-scrolling mobile nav strip (11 items in one
// row, everything past the first few required a swipe to even see). A
// slide-in drawer keeps the phone screen free for actual content — width
// is a compact ~65% of the viewport rather than a literal quarter, since
// much narrower makes the labels unreadable.
//
// The overlay is portaled straight to document.body rather than rendered
// where this component sits in the tree (inside <header>, which has
// backdrop-blur) — a blur/filter on an ancestor creates a new CSS
// containing block for position:fixed descendants, which otherwise traps
// the "full-viewport" overlay inside the header's own ~60px height.
export default function MobileNavDrawer({ watchlistCount }: { watchlistCount: number | null }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();

  useEffect(() => setMounted(true), []);

  function linkClass(active: boolean) {
    return `px-3 py-2.5 rounded-md text-sm font-medium transition ${
      active
        ? "bg-[var(--surface-2)] text-[var(--text-primary)]"
        : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-black/20"
    }`;
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Öppna meny"
        className="sm:hidden h-8 w-8 rounded-md border border-[var(--surface-border)] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
        </svg>
      </button>

      {mounted && open && createPortal(
        <div className="sm:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <div className="relative w-64 max-w-[70vw] h-full bg-[var(--surface)] border-r border-[var(--surface-border)] overflow-y-auto flex flex-col">
            <div className="flex items-center justify-between px-4 py-3.5 border-b border-[var(--surface-border)]">
              <span className="font-sans font-bold text-sm tracking-wide">
                <span className="text-[var(--text-primary)]">AURA</span>{" "}
                <span className="text-[var(--gold)]">TERMINAL</span>
              </span>
              <button
                onClick={() => setOpen(false)}
                aria-label="Stäng meny"
                className="h-7 w-7 rounded-md flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <nav className="flex flex-col gap-0.5 p-3">
              {MAIN_LINKS.map((link) => {
                const active = pathname === link.href;
                return (
                  <Link key={link.href} href={link.href} onClick={() => setOpen(false)} className={`${linkClass(active)} flex items-center gap-2`}>
                    {link.label}
                    {link.href === "/watchlist" && watchlistCount !== null && (
                      <span className="text-xs font-mono bg-[var(--gold)]/15 text-[var(--gold)] rounded-full px-1.5 py-0.5 min-w-[1.25rem] text-center">
                        {watchlistCount}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>

            <div className="flex flex-col gap-5 p-3 pt-1">
              {SIDEBAR_GROUPS.map((group) => (
                <div key={group.label}>
                  <p className="text-[11px] font-mono font-bold tracking-widest text-[var(--gold)] px-3 mb-1.5">
                    {group.label}
                  </p>
                  <nav className="flex flex-col gap-0.5">
                    {group.links.map((link) => {
                      const active = pathname === link.href || pathname.startsWith(link.href + "/");
                      return (
                        <Link key={link.href} href={link.href} onClick={() => setOpen(false)} className={linkClass(active)}>
                          {link.label}
                        </Link>
                      );
                    })}
                  </nav>
                </div>
              ))}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
