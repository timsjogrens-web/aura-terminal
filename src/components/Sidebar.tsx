"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const GROUPS: { label: string; links: { href: string; label: string }[] }[] = [
  {
    label: "RESEARCH",
    links: [
      { href: "/investors", label: "Investors" },
      { href: "/insiders", label: "Insiders" },
      { href: "/leaderboard", label: "Leaderboard" },
    ],
  },
  {
    label: "TOOLS",
    links: [
      { href: "/heatmap", label: "Heatmap" },
      { href: "/backtest", label: "Backtest" },
    ],
  },
  {
    label: "TRADING",
    links: [
      { href: "/paper", label: "Paper" },
      { href: "/self-trade", label: "Self Trade" },
    ],
  },
];

// Fixed full-height, rendered as a sibling of <header> from inside Header.tsx
// so every page that already includes <Header /> gets it automatically —
// no per-page layout changes needed. It sits behind the sticky header (see
// the pt- offset below) and body gets its left padding via the
// `body:has(.app-sidebar)` rule in globals.css, scoped to the same
// breakpoint this is shown at.
export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="app-sidebar hidden sm:flex flex-col fixed left-0 top-0 bottom-0 w-52 border-r border-[var(--surface-border)] bg-[var(--surface)]/80 backdrop-blur overflow-y-auto z-20 pt-20 pb-6 px-3 gap-6">
      {GROUPS.map((group) => (
        <div key={group.label}>
          <p className="text-[10px] font-mono tracking-widest text-[var(--text-muted)] px-3 mb-1.5">
            {group.label}
          </p>
          <nav className="flex flex-col gap-0.5">
            {group.links.map((link) => {
              const active = pathname === link.href || pathname.startsWith(link.href + "/");
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition ${
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
    </aside>
  );
}
