export const MAIN_LINKS = [
  { href: "/", label: "Hem" },
  { href: "/markets", label: "Marknader" },
  { href: "/watchlist", label: "Bevakningslista" },
  { href: "/history", label: "Historik" },
  { href: "/news", label: "Nyheter" },
];

export const SIDEBAR_GROUPS: { label: string; links: { href: string; label: string }[] }[] = [
  {
    label: "RESEARCH",
    links: [
      { href: "/investors", label: "Investerare" },
      { href: "/insiders", label: "Insiders" },
      { href: "/leaderboard", label: "Topplista" },
    ],
  },
  {
    label: "VERKTYG",
    links: [
      { href: "/heatmap", label: "Värmekarta" },
      { href: "/backtest", label: "Backtest" },
      { href: "/risk-calculator", label: "Riskkalkylator" },
    ],
  },
  {
    label: "HANDEL",
    links: [
      { href: "/paper", label: "Papperskonto" },
      { href: "/self-trade", label: "Egen handel" },
    ],
  },
  {
    label: "OM SAJTEN",
    links: [
      { href: "/methodology", label: "Metodik & ärlighet" },
      { href: "/track-record", label: "Track record" },
    ],
  },
];
