export const MAIN_LINKS = [
  { href: "/", label: "Hem" },
  { href: "/markets", label: "Marknader" },
  { href: "/watchlist", label: "Bevakningslista" },
  { href: "/history", label: "Historik" },
  { href: "/paper", label: "Papperskonto" },
];

export const SIDEBAR_GROUPS: { label: string; links: { href: string; label: string }[] }[] = [
  {
    label: "RESEARCH",
    links: [
      { href: "/investors", label: "Investerare" },
      { href: "/insiders", label: "Insiders" },
      // Was "Topplista" — sounds like a ranking of the best stocks, but the
      // page actually compares Candor's own paper account against 12 real
      // fund managers. Renamed so the label matches what's on the page.
      { href: "/leaderboard", label: "Mot proffsen" },
      { href: "/news", label: "Nyheter" },
    ],
  },
  {
    label: "VERKTYG",
    links: [{ href: "/risk-calculator", label: "Riskkalkylator" }],
  },
  {
    // Heatmap and the self-service backtest tool are the two most
    // "power user" pages on the site — pulled out of VERKTYG into their own,
    // clearly-labeled group instead of sitting next to the risk calculator
    // (which anyone sizing a trade would want front and center).
    label: "AVANCERAT",
    links: [
      { href: "/heatmap", label: "Värmekarta" },
      { href: "/backtest", label: "Backtest" },
    ],
  },
  {
    // Papperskonto lives in MAIN_LINKS (top bar, and the mobile drawer's
    // own top section) — listing it here too meant it showed up twice at
    // once, both copies highlighted as the active page whenever you were
    // actually on /paper.
    label: "HANDEL",
    links: [{ href: "/self-trade", label: "Egen handel (manuell)" }],
  },
  {
    label: "OM SAJTEN",
    links: [
      { href: "/methodology", label: "Metodik & ärlighet" },
      { href: "/track-record", label: "Track record (historisk)" },
    ],
  },
];
