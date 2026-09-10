"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SIDEBAR_GROUPS } from "@/lib/navConfig";

const WIDTH = 208; // px, matches the 13rem body padding in globals.css
const COLLAPSED_KEY = "aura_sidebar_collapsed";

// Fixed full-height, rendered as a sibling of <header> from inside Header.tsx
// so every page that already includes <Header /> gets it automatically —
// no per-page layout changes needed. It sits behind the sticky header (see
// the pt- offset below) and body gets its left padding via the
// `body:has(.app-sidebar)` rule in globals.css, scoped to the same
// breakpoint this is shown at (and to the un-collapsed state, via the
// data-collapsed attribute set below).
export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [transitionsEnabled, setTransitionsEnabled] = useState(false);

  // Sidebar remounts fresh on every navigation (it isn't in a shared root
  // layout), always starting collapsed=false. This corrects it in a
  // useLayoutEffect (runs before paint, unlike useEffect) so the wrong
  // expanded frame is never actually drawn — but that alone isn't enough:
  // a CSS transition fires off a value change between two style states
  // regardless of whether either was painted, so flipping the "enable
  // transitions" class on in the very same update as the correction still
  // animates from the default width to the real one. Splitting these into
  // two separate updates — snap to the correct width first with no
  // transition class present at all, then arm transitions afterwards, once
  // that width has already painted — makes the correction instant and
  // keeps the animation for actual user-initiated toggles only.
  useLayoutEffect(() => {
    setCollapsed(localStorage.getItem(COLLAPSED_KEY) === "1");
  }, []);

  useEffect(() => {
    setTransitionsEnabled(true);
  }, []);

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem(COLLAPSED_KEY, next ? "1" : "0");
  }

  return (
    <>
      <aside
        data-collapsed={collapsed}
        style={{ width: collapsed ? 0 : WIDTH }}
        className={`app-sidebar hidden sm:flex flex-col fixed left-0 top-0 bottom-0 border-r border-[var(--surface-border)] bg-[var(--surface)]/80 backdrop-blur overflow-hidden z-20 pt-20 pb-6 gap-6 ${
          transitionsEnabled ? "transition-[width] duration-200 ease-in-out" : ""
        }`}
      >
        <div className="overflow-y-auto px-3 flex flex-col gap-6" style={{ width: WIDTH }}>
          {SIDEBAR_GROUPS.map((group) => (
            <div key={group.label}>
              <p className="text-[11px] font-mono font-bold tracking-widest text-[var(--gold)] px-3 mb-2 whitespace-nowrap">
                {group.label}
              </p>
              <nav className="flex flex-col gap-0.5">
                {group.links.map((link) => {
                  const active = pathname === link.href || pathname.startsWith(link.href + "/");
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={`px-3 py-2 rounded-md text-sm font-medium transition whitespace-nowrap ${
                        active
                          ? "bg-[var(--surface-2)] text-[var(--text-primary)]"
                          : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-black/20"
                      }`}
                    >
                      {link.label}
                    </Link>
                  );
                })}
              </nav>
            </div>
          ))}
        </div>
      </aside>

      <button
        onClick={toggle}
        title={collapsed ? "Show sidebar" : "Hide sidebar"}
        style={{ left: collapsed ? 8 : WIDTH - 28 }}
        className={`hidden sm:flex items-center justify-center h-6 w-6 rounded-md border border-[var(--surface-border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:text-[var(--gold)] hover:border-[var(--gold-dim)] fixed top-[18px] z-40 ${
          transitionsEnabled ? "transition-[left] duration-200 ease-in-out" : ""
        }`}
      >
        <svg
          viewBox="0 0 24 24"
          className={`h-3.5 w-3.5 transition-transform ${collapsed ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
        >
          <path d="M15 6l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </>
  );
}
