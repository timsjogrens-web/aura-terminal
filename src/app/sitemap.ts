import type { MetadataRoute } from "next";
import { DEFAULT_UNIVERSE } from "@/lib/universe";

const BASE_URL = "https://tsterminal.vercel.app";

// Static, publicly-viewable pages (GET is open to everyone — see
// proxy.ts — even though most link to account-only actions). Anything
// behind a form submission or requiring a session to be USEFUL (paper,
// self-trade, watchlist) is still technically viewable and worth
// indexing, just lower priority than the pitch/markets/methodology pages.
const STATIC_PAGES: { path: string; priority: number }[] = [
  { path: "/", priority: 1 },
  { path: "/markets", priority: 0.9 },
  { path: "/methodology", priority: 0.8 },
  { path: "/track-record", priority: 0.8 },
  { path: "/risk-calculator", priority: 0.6 },
  { path: "/backtest", priority: 0.6 },
  { path: "/heatmap", priority: 0.6 },
  { path: "/history", priority: 0.6 },
  { path: "/insiders", priority: 0.5 },
  { path: "/investors", priority: 0.5 },
  { path: "/leaderboard", priority: 0.5 },
  { path: "/paper", priority: 0.4 },
  { path: "/self-trade", priority: 0.4 },
  { path: "/watchlist", priority: 0.3 },
  { path: "/privacy", priority: 0.2 },
  { path: "/terms", priority: 0.2 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const staticEntries = STATIC_PAGES.map((p) => ({
    url: `${BASE_URL}${p.path}`,
    lastModified: now,
    priority: p.priority,
  }));
  // One entry per tracked stock — real, substantial, frequently-updated
  // content (live price, score, news, signal history), exactly the kind
  // of page worth a search engine's attention.
  const stockEntries = DEFAULT_UNIVERSE.map((e) => ({
    url: `${BASE_URL}/stock/${e.ticker}`,
    lastModified: now,
    priority: 0.5,
  }));
  return [...staticEntries, ...stockEntries];
}
