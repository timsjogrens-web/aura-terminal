"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import PriceChart from "@/components/PriceChart";
import CompanyLogo from "@/components/CompanyLogo";
import SignalBadge from "@/components/SignalBadge";
import { formatPct, formatPrice } from "@/lib/format";
import { useAuthStatus } from "@/lib/useAuthStatus";
import { useQuotes } from "@/lib/useQuotes";

interface SearchResult {
  symbol: string;
  description: string;
}

interface WeeklyPick {
  ticker: string;
  companyName: string | null;
  price: number | null;
  logo: string | null;
  signal: string;
  score: number | null;
  signaledAt: string;
}

interface LiveQuote {
  ticker: string;
  price: number;
  change: number;
  changePct: number;
  name: string | null;
  logo: string | null;
}

interface Position {
  ticker: string;
  shares: number;
  entryPrice: number;
  entryDate: string;
  currentPrice: number;
  value: number;
  returnPct: number;
  logo?: string | null;
  signal: string | null;
  score: number | null;
}

interface Trade {
  id: number;
  ticker: string;
  action: "BUY" | "SELL";
  shares: number;
  price: number;
  timestamp: string;
  logo?: string | null;
}

interface PortfolioData {
  startingCash: number;
  cash: number;
  totalValue: number;
  totalReturnPct: number;
  unrealizedPnl: number;
  realizedPnl: number;
  startedAt: string | null;
  positions: Position[];
  trades: Trade[];
}

function formatMoney(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function formatSignedMoney(n: number): string {
  const sign = n >= 0 ? "+" : "";
  return sign + formatMoney(n);
}

export default function SelfTradePage() {
  const router = useRouter();
  const auth = useAuthStatus();
  const loggedIn = auth ? auth.loggedIn : null; // any account can self-trade, not just the admin
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [live, setLive] = useState<LiveQuote | null>(null);
  const [liveError, setLiveError] = useState<string | null>(null);
  const [side, setSide] = useState<"BUY" | "SELL">("BUY");
  const [shares, setShares] = useState("");
  const [amountText, setAmountText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [tradeError, setTradeError] = useState<string | null>(null);
  const [portfolio, setPortfolio] = useState<PortfolioData | null>(null);
  const [weeklyPicks, setWeeklyPicks] = useState<WeeklyPick[] | null>(null);
  const [showAllSignals, setShowAllSignals] = useState(false);
  const tradePanelRef = useRef<HTMLDivElement | null>(null);

  // The full, unfiltered list — still available on demand ("Visa alla
  // aktuella signaler") for anyone who specifically wants to browse every
  // current BUY/STRONG BUY ticker, not just the curated weekly shortlist
  // above. Kept separate from weeklyPicks rather than replacing it.
  const { data: quotesData } = useQuotes();
  const allBuySignals = (quotesData?.quotes ?? [])
    .filter((q) => q.signal === "STRONG BUY" || q.signal === "BUY")
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

  // A small, stable shortlist instead of "every current BUY/STRONG BUY
  // signal" (which can be 20-30+ tickers at once) — fine for the
  // auto-bot, unrealistic for a person to actually buy all of with their
  // own money. See lib/weeklyPicks.ts for the ranking logic.
  useEffect(() => {
    fetch("/api/weekly-picks")
      .then((r) => (r.ok ? r.json() : { picks: [] }))
      .then((json) => setWeeklyPicks(json.picks ?? []))
      .catch(() => setWeeklyPicks([]));
  }, []);

  // The trade panel renders near the top of the page, above the open-
  // positions table further down — picking a ticker from that table (or
  // from the "Sälj" button on a row) would otherwise open the panel
  // off-screen, above whatever the user was already scrolled to, making
  // it look like nothing happened. Scroll it into view whenever a ticker
  // becomes selected, regardless of where the click came from.
  useEffect(() => {
    if (selected) tradePanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [selected]);

  const loadPortfolio = useCallback(() => {
    fetch("/api/manual-trade")
      .then((r) => (r.ok ? r.json() : null))
      .then(setPortfolio)
      .catch(() => setPortfolio(null));
  }, []);

  useEffect(() => {
    // Each account has its own portfolio now, so there's nothing to load
    // (and no point trying, since the API requires a session) until we
    // know who's logged in.
    if (loggedIn === true) loadPortfolio();
  }, [loggedIn, loadPortfolio]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const id = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(query)}`)
        .then((r) => r.json())
        .then((json) => setResults(json.results ?? []))
        .catch(() => setResults([]));
    }, 300);
    return () => clearTimeout(id);
  }, [query]);

  const selectTicker = useCallback((ticker: string, presetSide?: "BUY" | "SELL") => {
    setSelected(ticker);
    setQuery("");
    setResults([]);
    setLive(null);
    setLiveError(null);
    setShares("");
    setAmountText("");
    setTradeError(null);
    if (presetSide) setSide(presetSide);
    fetch(`/api/quote-lookup?ticker=${ticker}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.error) setLiveError(json.error);
        else setLive(json);
      })
      .catch(() => setLiveError("Kunde inte ladda ett livepris."));
  }, []);

  async function submitTrade() {
    if (!selected || !shares) return;
    setSubmitting(true);
    setTradeError(null);
    try {
      const res = await fetch("/api/manual-trade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker: selected, action: side, shares: Number(shares) }),
      });
      const json = await res.json();
      if (!res.ok) {
        setTradeError(json.error ?? "Affären misslyckades.");
        return;
      }
      setShares("");
      setAmountText("");
      loadPortfolio();
      selectTicker(selected, side); // refresh live price after the trade
    } finally {
      setSubmitting(false);
    }
  }

  const cost = live && shares ? Number(shares) * live.price : 0;
  const heldShares = portfolio?.positions.find((p) => p.ticker === selected)?.shares ?? 0;
  const heldValue = live ? heldShares * live.price : 0;
  const availableCash = portfolio?.cash ?? 0;

  // Both quick-pick paths (a dollar amount to buy for, or a % of a held
  // position to sell), and typing directly into either the ANTAL or
  // BELOPP box below, all just set both `shares` (the source of truth
  // actually submitted) and `amountText` (its dollar equivalent) together
  // — the two boxes stay in sync no matter which one you used.
  function pickBuyAmount(amount: number) {
    if (!live || !live.price) return;
    setAmountText(String(Math.round(amount * 100) / 100));
    setShares(String(amount / live.price));
  }

  function pickSellPortion(pct: number) {
    if (!live) return;
    const sh = heldShares * (pct / 100);
    setShares(String(sh));
    setAmountText(String(Math.round(sh * live.price * 100) / 100));
  }

  function handleSharesInput(value: string) {
    const cleaned = value.replace(/[^0-9.]/g, "");
    setShares(cleaned);
    setAmountText(live && cleaned ? String(Math.round(Number(cleaned) * live.price * 100) / 100) : "");
  }

  function handleAmountInput(value: string) {
    const cleaned = value.replace(/[^0-9.]/g, "");
    setAmountText(cleaned);
    setShares(live && live.price && cleaned ? String(Number(cleaned) / live.price) : "");
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <section className="mx-auto max-w-5xl w-full px-4 sm:px-6 pt-12 pb-16 flex-1">
        <div className="flex items-start justify-between gap-4 flex-wrap mb-2">
          <h1 className="font-serif font-bold text-3xl sm:text-4xl text-[var(--text-primary)]">
            Egen handel
          </h1>
          <span className="text-[10px] font-mono tracking-widest bg-[rgba(239,68,68,0.12)] text-[var(--red)] border border-[rgba(239,68,68,0.35)] rounded px-2 py-1 self-start">
            SIMULERAT · INGA RIKTIGA PENGAR
          </span>
        </div>
        <p className="text-[var(--text-secondary)] mb-8 max-w-2xl">
          Ditt eget {portfolio ? formatMoney(portfolio.startingCash) : "$100,000"}-konto — du väljer
          själv vad som köps och säljs, live, framåt i tiden. Separat från boten som handlar
          automatiskt på{" "}
          <Link href="/paper" className="text-[var(--accent)] hover:underline">
            Papperskonto
          </Link>
          -sidan, och separat från{" "}
          <Link href="/track-record" className="text-[var(--accent)] hover:underline">
            Track record
          </Link>
          , som bara visar hur det hade gått bakåt i tiden. Varje konto är helt separat — ditt
          eget, med din egen $100 000 att börja med.
        </p>

        {loggedIn === false && (
          <div className="rounded-lg border border-[var(--accent-dim)] bg-[rgba(111,176,224,0.06)] px-4 py-3 mb-6 text-sm text-[var(--text-secondary)]">
            Du måste ha ett konto för att handla här.{" "}
            <Link href="/signup" className="text-[var(--accent)] underline">
              Skapa konto
            </Link>{" "}
            (startar på $100 000) eller{" "}
            <Link href="/login" className="text-[var(--accent)] underline">
              logga in
            </Link>
            .
          </div>
        )}

        <div className="relative mb-6">
          <svg
            viewBox="0 0 24 24"
            className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)] pointer-events-none"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4-4" strokeLinecap="round" />
          </svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value.toUpperCase())}
            placeholder="Sök valfri aktie (t.ex. NFLX)"
            className="w-full rounded-md border border-[var(--surface-border)] bg-black/30 pl-9 sm:pl-11 pr-2.5 sm:pr-4 py-3 text-sm font-mono text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
          />
          {results.length > 0 && (
            <div className="absolute z-10 mt-1 w-full rounded-md border border-[var(--surface-border)] bg-[var(--surface)] shadow-lg overflow-hidden">
              {results.map((r) => (
                <button
                  key={r.symbol}
                  onClick={() => selectTicker(r.symbol)}
                  className="w-full text-left px-4 py-2.5 hover:bg-black/30 flex items-center justify-between gap-3"
                >
                  <span className="font-mono font-semibold text-[var(--text-primary)]">{r.symbol}</span>
                  <span className="text-xs text-[var(--text-secondary)] truncate">{r.description}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {weeklyPicks && weeklyPicks.length > 0 && (
          <div className="mb-8">
            <h2 className="font-sans font-bold text-lg text-[var(--text-primary)] flex items-center gap-2 mb-1.5">
              <svg viewBox="0 0 24 24" className="h-5 w-5 text-[var(--accent)]" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2l2.5 6.5L21 9l-5 4.5L17.5 21 12 17l-5.5 4L8 13.5 3 9l6.5-.5z" strokeLinejoin="round" />
              </svg>
              Topp 5 för veckan — välj direkt
            </h2>
            <p className="text-sm text-[var(--text-secondary)] mb-3 max-w-2xl">
              De 5 starkaste köpsignalerna just nu. Du behöver inte följa alla 33 aktuella signaler —
              plocka några du gillar här, eller sök upp något annat nedan.
            </p>
            <div className="flex flex-wrap gap-2">
              {weeklyPicks.map((q) => (
                <button
                  key={q.ticker}
                  onClick={() => selectTicker(q.ticker, "BUY")}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 transition ${
                    selected === q.ticker
                      ? "border-[var(--accent)] bg-[rgba(111,176,224,0.08)]"
                      : "border-[var(--surface-border)] bg-[var(--surface)] hover:border-[var(--accent-dim)]"
                  }`}
                >
                  <CompanyLogo ticker={q.ticker} logoUrl={q.logo} size={20} />
                  <span className="font-mono font-semibold text-sm text-[var(--text-primary)]">{q.ticker}</span>
                  <SignalBadge signal={q.signal} score={q.score} />
                  <span className="font-mono text-sm text-[var(--text-secondary)]">
                    {q.price !== null ? `$${formatPrice(q.price)}` : "—"}
                  </span>
                </button>
              ))}
            </div>

            {allBuySignals.length > 0 && (
              <button
                onClick={() => setShowAllSignals((v) => !v)}
                className="mt-3 text-sm font-medium text-[var(--accent)] hover:underline"
              >
                {showAllSignals ? "Visa färre" : `Visa alla aktuella signaler (${allBuySignals.length})`}
              </button>
            )}

            {showAllSignals && (
              <div className="flex flex-wrap gap-2 mt-3">
                {allBuySignals.map((q) => (
                  <button
                    key={q.ticker}
                    onClick={() => selectTicker(q.ticker, "BUY")}
                    className={`flex items-center gap-2 rounded-lg border px-3 py-2 transition ${
                      selected === q.ticker
                        ? "border-[var(--accent)] bg-[rgba(111,176,224,0.08)]"
                        : "border-[var(--surface-border)] bg-[var(--surface)] hover:border-[var(--accent-dim)]"
                    }`}
                  >
                    <CompanyLogo ticker={q.ticker} logoUrl={q.logo} size={20} />
                    <span className="font-mono font-semibold text-sm text-[var(--text-primary)]">{q.ticker}</span>
                    <SignalBadge signal={q.signal} score={q.score} />
                    <span className="font-mono text-sm text-[var(--text-secondary)]">
                      {q.price !== null ? `$${formatPrice(q.price)}` : "—"}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {selected && (
          <div ref={tradePanelRef} className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] p-5 mb-8">
            {liveError && <p className="text-sm text-[var(--red)] mb-3">{liveError}</p>}
            {live && (
              <>
                <div className="flex items-center justify-between gap-4 flex-wrap mb-4">
                  <div className="flex items-center gap-3">
                    <CompanyLogo ticker={live.ticker} logoUrl={live.logo} size={36} />
                    <div>
                      <p className="font-mono font-bold text-lg text-[var(--text-primary)]">{live.ticker}</p>
                      <p className="text-xs text-[var(--text-secondary)]">{live.name}</p>
                    </div>
                  </div>
                  <p className={`font-mono text-sm ${live.changePct >= 0 ? "text-[var(--green)]" : "text-[var(--red)]"}`}>
                    {formatPct(live.changePct)} idag
                  </p>
                </div>

                <div className="mb-5">
                  <PriceChart ticker={live.ticker} changePct={live.changePct} />
                </div>

                {/* Same live price shown on both sides — Finnhub's free tier gives
                    a single last-traded price, not a real bid/ask spread, so
                    showing two different numbers here would fabricate a spread
                    we don't actually have data for. */}
                <div className="grid grid-cols-2 gap-3 mb-2">
                  <button
                    onClick={() => {
                      setSide("SELL");
                      setShares("");
                      setAmountText("");
                    }}
                    className={`rounded-lg border-2 py-4 text-center transition ${
                      side === "SELL"
                        ? "border-[var(--red)] bg-[rgba(239,68,68,0.12)]"
                        : "border-[var(--surface-border)] hover:border-[rgba(239,68,68,0.4)]"
                    }`}
                  >
                    <p className="text-xs font-mono font-bold tracking-widest text-[var(--red)] mb-1.5">SÄLJ</p>
                    <p className="font-mono text-2xl font-bold text-[var(--text-primary)]">${formatPrice(live.price)}</p>
                  </button>
                  <button
                    onClick={() => {
                      setSide("BUY");
                      setShares("");
                      setAmountText("");
                    }}
                    className={`rounded-lg border-2 py-4 text-center transition ${
                      side === "BUY"
                        ? "border-[var(--green)] bg-[rgba(34,197,94,0.12)]"
                        : "border-[var(--surface-border)] hover:border-[rgba(34,197,94,0.4)]"
                    }`}
                  >
                    <p className="text-xs font-mono font-bold tracking-widest text-[var(--green)] mb-1.5">KÖP</p>
                    <p className="font-mono text-2xl font-bold text-[var(--text-primary)]">${formatPrice(live.price)}</p>
                  </button>
                </div>
                {/* What you actually have available, shown right where the
                    decision is made — cash to spend when buying, current
                    holding when selling — instead of making you scroll down
                    to the stats cards to check before typing a number. */}
                <p className="text-xs font-mono text-[var(--text-muted)] mb-3">
                  {side === "BUY"
                    ? `Tillgängligt att köpa för: ${formatMoney(availableCash)}`
                    : `Du äger ${heldShares.toFixed(4)} st (${formatMoney(heldValue)})`}
                </p>

                <div className="flex gap-2 flex-wrap mb-4">
                  {side === "BUY"
                    ? [500, 1000, 2500].map((amt) => (
                        <button
                          key={amt}
                          onClick={() => pickBuyAmount(amt)}
                          disabled={amt > availableCash}
                          className="text-xs font-mono border border-[var(--surface-border)] rounded-md px-3 py-1.5 text-[var(--text-secondary)] hover:border-[var(--accent-dim)] hover:text-[var(--text-primary)] disabled:opacity-40 disabled:hover:border-[var(--surface-border)] transition"
                        >
                          ${amt.toLocaleString("en-US")}
                        </button>
                      ))
                    : [25, 50, 100].map((pct) => (
                        <button
                          key={pct}
                          onClick={() => pickSellPortion(pct)}
                          disabled={heldShares <= 0}
                          className="text-xs font-mono border border-[var(--surface-border)] rounded-md px-3 py-1.5 text-[var(--text-secondary)] hover:border-[var(--accent-dim)] hover:text-[var(--text-primary)] disabled:opacity-40 transition"
                        >
                          {pct === 100 ? "Sälj allt" : `${pct}%`}
                        </button>
                      ))}
                  {side === "BUY" && (
                    <button
                      onClick={() => pickBuyAmount(availableCash)}
                      disabled={availableCash <= 0}
                      className="text-xs font-mono border border-[var(--surface-border)] rounded-md px-3 py-1.5 text-[var(--text-secondary)] hover:border-[var(--accent-dim)] hover:text-[var(--text-primary)] disabled:opacity-40 transition"
                    >
                      Max
                    </button>
                  )}
                </div>

                {/* Both units editable at once, each side syncing the other
                    live — type shares and the dollar amount fills in, or
                    type a dollar amount and the share count fills in. */}
                <div className="flex items-end gap-3 flex-wrap mt-4">
                  <div>
                    <label className="text-sm font-medium text-[var(--text-secondary)] block mb-1.5">
                      Antal
                    </label>
                    <input
                      value={shares}
                      onChange={(e) => handleSharesInput(e.target.value)}
                      placeholder="0"
                      className="w-28 rounded-md border border-[var(--surface-border)] bg-black/30 px-3 py-2 text-sm font-mono text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
                    />
                  </div>
                  <span className="text-[var(--text-muted)] pb-2.5">≈</span>
                  <div>
                    <label className="text-sm font-medium text-[var(--text-secondary)] block mb-1.5">
                      Belopp
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-mono text-[var(--text-muted)] pointer-events-none">
                        $
                      </span>
                      <input
                        value={amountText}
                        onChange={(e) => handleAmountInput(e.target.value)}
                        placeholder="0"
                        className="w-28 rounded-md border border-[var(--surface-border)] bg-black/30 pl-6 pr-3 py-2 text-sm font-mono text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
                      />
                    </div>
                  </div>
                  <p className="text-sm font-mono text-[var(--text-secondary)] pb-2.5">
                    {side === "BUY" ? "Kostnad" : "Intäkt"}: ${cost.toFixed(2)}
                  </p>
                  <button
                    onClick={submitTrade}
                    disabled={submitting || !shares || Number(shares) <= 0 || loggedIn === false}
                    title={loggedIn === false ? "Logga in för att lägga en affär" : undefined}
                    className={`px-5 py-2 rounded-md text-sm font-semibold transition disabled:opacity-50 ${
                      side === "BUY" ? "bg-[var(--green)] text-black" : "bg-[var(--red)] text-black"
                    }`}
                  >
                    {submitting ? "Skickar…" : side === "BUY" ? `Köp ${live.ticker}` : `Sälj ${live.ticker}`}
                  </button>
                </div>
                {tradeError && <p className="text-sm text-[var(--red)] mt-3">{tradeError}</p>}
              </>
            )}
          </div>
        )}

        {portfolio && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
              <div className="rounded-lg border border-[var(--surface-border)] border-l-[3px] border-l-[var(--surface-border)] bg-[var(--surface)] p-4">
                <p className="text-sm font-medium text-[var(--text-secondary)] mb-1">Totalt värde</p>
                <p className="font-mono text-xl font-bold text-[var(--text-primary)]">{formatMoney(portfolio.totalValue)}</p>
              </div>
              <div
                className={`rounded-lg border border-[var(--surface-border)] border-l-[3px] bg-[var(--surface)] p-4 ${
                  portfolio.totalReturnPct >= 0 ? "border-l-[var(--green)]" : "border-l-[var(--red)]"
                }`}
              >
                <p className="text-sm font-medium text-[var(--text-secondary)] mb-1">Avkastning</p>
                <p className={`font-mono text-xl font-bold ${portfolio.totalReturnPct >= 0 ? "text-[var(--green)]" : "text-[var(--red)]"}`}>
                  {formatPct(portfolio.totalReturnPct)}
                </p>
              </div>
              <div className="rounded-lg border border-[var(--surface-border)] border-l-[3px] border-l-[var(--surface-border)] bg-[var(--surface)] p-4">
                <p className="text-sm font-medium text-[var(--text-secondary)] mb-1">Kontanter</p>
                <p className="font-mono text-xl font-bold text-[var(--text-primary)]">{formatMoney(portfolio.cash)}</p>
              </div>
              <div className="rounded-lg border border-[var(--surface-border)] border-l-[3px] border-l-[var(--accent)] bg-[var(--surface)] p-4">
                <p className="text-sm font-medium text-[var(--text-secondary)] mb-1">Öppna positioner</p>
                <p className="font-mono text-xl font-bold text-[var(--text-primary)]">{portfolio.positions.length}</p>
              </div>
            </div>

            {(portfolio.unrealizedPnl !== 0 || portfolio.realizedPnl !== 0) && (
              <p className="text-xs font-mono text-[var(--text-muted)] mb-8 -mt-4">
                Orealiserat (öppna positioner):{" "}
                <span className={portfolio.unrealizedPnl >= 0 ? "text-[var(--green)]" : "text-[var(--red)]"}>
                  {formatSignedMoney(portfolio.unrealizedPnl)}
                </span>
                {" · "}
                Realiserat (avslutade affärer hittills):{" "}
                <span className={portfolio.realizedPnl >= 0 ? "text-[var(--green)]" : "text-[var(--red)]"}>
                  {formatSignedMoney(portfolio.realizedPnl)}
                </span>
              </p>
            )}

            {portfolio.positions.length > 0 && (
              <div className="mb-8">
                <p className="text-xs font-mono tracking-widest text-[var(--text-muted)] mb-1.5">ÖPPNA POSITIONER</p>
                <p className="text-sm text-[var(--text-secondary)] mb-3 max-w-2xl">
                  SIGNAL visar vad modellen tycker om aktien just nu, inte bara vad du köpte den för.
                  Byter den till <span className="text-[var(--red)] font-medium">SELL</span> eller{" "}
                  <span className="text-[var(--red)] font-medium">STRONG SELL</span> är det modellens sätt att
                  säga att det kan vara läge att sälja — men det säljer aldrig åt dig automatiskt.
                </p>
                <div className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] overflow-hidden">
                  <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[var(--surface-border)] text-left text-xs font-mono tracking-widest text-[var(--text-muted)]">
                        <th className="px-2 lg:px-2.5 xl:px-4 py-3 font-medium">TICKER</th>
                        <th className="px-2 lg:px-2.5 xl:px-4 py-3 font-medium text-right">ANTAL</th>
                        <th className="px-2 lg:px-2.5 xl:px-4 py-3 font-medium text-right">SNITTKOSTNAD</th>
                        <th className="px-2 lg:px-2.5 xl:px-4 py-3 font-medium text-right">NUVARANDE</th>
                        <th className="px-2 lg:px-2.5 xl:px-4 py-3 font-medium text-right">AVKASTNING</th>
                        <th className="px-2 lg:px-2.5 xl:px-4 py-3 font-medium text-right">VÄRDE</th>
                        <th className="px-2 lg:px-2.5 xl:px-4 py-3 font-medium">SIGNAL</th>
                        <th className="px-2 lg:px-2.5 xl:px-4 py-3 font-medium"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {portfolio.positions.map((p) => (
                        <tr
                          key={p.ticker}
                          onClick={() => selectTicker(p.ticker, "BUY")}
                          className="border-b border-[var(--surface-border)] last:border-0 hover:bg-black/20 cursor-pointer transition-colors"
                        >
                          <td className="px-2 lg:px-2.5 xl:px-4 py-3">
                            <Link
                              href={`/stock/${p.ticker}`}
                              onClick={(e) => e.stopPropagation()}
                              className="flex items-center gap-2 font-mono font-semibold text-[var(--accent)] hover:underline"
                            >
                              <CompanyLogo ticker={p.ticker} logoUrl={p.logo} size={20} />
                              {p.ticker}
                            </Link>
                          </td>
                          <td className="px-2 lg:px-2.5 xl:px-4 py-3 text-right font-mono text-[var(--text-secondary)] whitespace-nowrap">
                            {p.shares.toFixed(4)}
                          </td>
                          <td className="px-2 lg:px-2.5 xl:px-4 py-3 text-right font-mono text-[var(--text-secondary)] whitespace-nowrap">
                            ${formatPrice(p.entryPrice)}
                          </td>
                          <td className="px-2 lg:px-2.5 xl:px-4 py-3 text-right font-mono text-[var(--text-primary)] whitespace-nowrap">
                            ${formatPrice(p.currentPrice)}
                          </td>
                          <td className={`px-2 lg:px-2.5 xl:px-4 py-3 text-right font-mono whitespace-nowrap ${p.returnPct >= 0 ? "text-[var(--green)]" : "text-[var(--red)]"}`}>
                            {formatPct(p.returnPct)}
                          </td>
                          <td className="px-2 lg:px-2.5 xl:px-4 py-3 text-right font-mono text-[var(--text-primary)] whitespace-nowrap">
                            {formatMoney(p.value)}
                          </td>
                          <td className="px-2 lg:px-2.5 xl:px-4 py-3">
                            {p.signal ? (
                              <SignalBadge signal={p.signal} score={null} />
                            ) : (
                              <span className="text-xs text-[var(--text-muted)]" title="Den här aktien ingår inte i de 167 spårade — ingen signal beräknas för den.">
                                Ej spårad
                              </span>
                            )}
                          </td>
                          <td className="px-2 lg:px-2.5 xl:px-4 py-3 text-right">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                selectTicker(p.ticker, "SELL");
                              }}
                              className="text-xs font-mono border border-[var(--surface-border)] rounded px-2 py-1 text-[var(--text-secondary)] hover:text-[var(--red)] hover:border-[var(--red)]"
                            >
                              Sälj
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>
                </div>
              </div>
            )}

            <div>
              <p className="text-xs font-mono tracking-widest text-[var(--text-muted)] mb-3">HANDELSLOGG</p>
              {portfolio.trades.length === 0 ? (
                <p className="text-[var(--text-muted)] text-sm">Inga affärer ännu — sök en aktie ovan och gör din första.</p>
              ) : (
                <div className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] overflow-hidden">
                  <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[var(--surface-border)] text-left text-xs font-mono tracking-widest text-[var(--text-muted)]">
                        <th className="px-2.5 sm:px-4 py-3 font-medium">ÅTGÄRD</th>
                        <th className="px-2.5 sm:px-4 py-3 font-medium">TICKER</th>
                        <th className="px-2.5 sm:px-4 py-3 font-medium text-right">ANTAL</th>
                        <th className="px-2.5 sm:px-4 py-3 font-medium text-right">PRIS</th>
                        <th className="px-2.5 sm:px-4 py-3 font-medium text-right">NÄR</th>
                      </tr>
                    </thead>
                    <tbody>
                      {portfolio.trades.map((t) => (
                        <tr
                          key={t.id}
                          onClick={() => router.push(`/stock/${t.ticker}`)}
                          className="border-b border-[var(--surface-border)] last:border-0 hover:bg-black/20 cursor-pointer transition-colors"
                        >
                          <td className="px-2.5 sm:px-4 py-3">
                            <span
                              className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${
                                t.action === "BUY" ? "bg-[rgba(34,197,94,0.12)] text-[var(--green)]" : "bg-[rgba(239,68,68,0.12)] text-[var(--red)]"
                              }`}
                            >
                              {t.action}
                            </span>
                          </td>
                          <td className="px-2.5 sm:px-4 py-3">
                            <Link
                              href={`/stock/${t.ticker}`}
                              onClick={(e) => e.stopPropagation()}
                              className="flex items-center gap-2 font-mono font-semibold text-[var(--text-primary)] hover:text-[var(--accent)]"
                            >
                              <CompanyLogo ticker={t.ticker} logoUrl={t.logo} size={20} />
                              {t.ticker}
                            </Link>
                          </td>
                          <td className="px-2.5 sm:px-4 py-3 text-right font-mono text-[var(--text-secondary)] whitespace-nowrap">
                            {t.shares.toFixed(4)}
                          </td>
                          <td className="px-2.5 sm:px-4 py-3 text-right font-mono text-[var(--text-secondary)] whitespace-nowrap">
                            ${formatPrice(t.price)}
                          </td>
                          <td className="px-2.5 sm:px-4 py-3 text-right text-xs font-mono text-[var(--text-muted)] whitespace-nowrap">
                            {new Date(t.timestamp).toLocaleString("sv-SE")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </section>

      <Footer />
    </div>
  );
}
