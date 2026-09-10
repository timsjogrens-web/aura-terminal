export const MAIN_LINKS = [
  { href: "/", label: "Markets" },
  { href: "/watchlist", label: "Watchlist" },
  { href: "/history", label: "History" },
  { href: "/news", label: "News" },
];

export const SIDEBAR_GROUPS: { label: string; links: { href: string; label: string }[] }[] = [
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
      { href: "/risk-calculator", label: "Risk Calculator" },
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
