"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import CompanyLogo from "@/components/CompanyLogo";
import { DEFAULT_UNIVERSE } from "@/lib/universe";
import { formatPct } from "@/lib/format";
import { useQuotes } from "@/lib/useQuotes";

interface BacktestRow {
  date: string;
  execDate: string | null;
  signalPrice: number;
  execPrice: number | null;
  score: number;
  signal: string;
  outcome: "hit" | "miss" | null;
}

interface BacktestResult {
  ticker: string;
  weights: { trend: number; momentum: number; volume: number };
  rows: BacktestRow[];
  hitRate: number | null;
  evaluated: number;
  hits: number;
  buySignalCount: number;
}

const RANGES = ["6M", "1Y", "2Y"];

export default function BacktestPage() {
  const [ticker, setTicker] = useState("AAPL");
  const [range, setRange] = useState("1Y");
  const [trend, setTrend] = useState(40);
  const [momentum, setMomentum] = useState(30);
  const [volume, setVolume] = useState(30);
  const [live, setLive] = useState<BacktestResult | null>(null);
  const [custom, setCustom] = useState<BacktestResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Collapsed by default, same reasoning as the paper-trading page's
  // "Visa mer" — the full methodology writeup used to sit above the
  // actual tool (the ticker picker, sliders, "Kör backtest" button),
  // which made the tool itself easy to miss on first look.
  const [showMethodDetails, setShowMethodDetails] = useState(false);

  // Real logos, not just the colored-initial fallback — the same quote
  // feed every other page already uses, keyed by ticker for a quick
  // lookup. A plain <select> can never show these (browsers only ever
  // render <option> as plain text, no images), which is why the ticker
  // picker gets a custom dropdown below instead of a native <select>.
  const { data: quotesData } = useQuotes();
  const logoByTicker = useMemo(() => {
    const map = new Map<string, string | null>();
    for (const q of quotesData?.quotes ?? []) map.set(q.ticker, q.logo ?? null);
    return map;
  }, [quotesData]);

  const [tickerOpen, setTickerOpen] = useState(false);
  const [tickerQuery, setTickerQuery] = useState("");
  const tickerBoxRef = useRef<HTMLDivElement | null>(null);
  const selectedEntry = DEFAULT_UNIVERSE.find((e) => e.ticker === ticker);
  const filteredUniverse = useMemo(() => {
    const q = tickerQuery.trim().toUpperCase();
    if (!q) return DEFAULT_UNIVERSE;
    return DEFAULT_UNIVERSE.filter(
      (e) => e.ticker.includes(q) || e.name.toUpperCase().includes(q)
    );
  }, [tickerQuery]);

  useEffect(() => {
    function onOutsideClick(e: MouseEvent) {
      if (tickerBoxRef.current && !tickerBoxRef.current.contains(e.target as Node)) {
        setTickerOpen(false);
      }
    }
    document.addEventListener("mousedown", onOutsideClick);
    return () => document.removeEventListener("mousedown", onOutsideClick);
  }, []);

  function pickTicker(t: string) {
    setTicker(t);
    setTickerOpen(false);
    setTickerQuery("");
  }

  async function run() {
    setLoading(true);
    setError(null);
    try {
      const [liveRes, customRes] = await Promise.all([
        fetch(`/api/backtest?ticker=${ticker}&range=${range}&trend=40&momentum=30&volume=30`).then((r) => r.json()),
        fetch(`/api/backtest?ticker=${ticker}&range=${range}&trend=${trend}&momentum=${momentum}&volume=${volume}`).then((r) => r.json()),
      ]);
      if (liveRes.error || customRes.error) {
        setError(liveRes.error ?? customRes.error);
        setLive(null);
        setCustom(null);
      } else {
        setLive(liveRes);
        setCustom(customRes);
      }
    } catch {
      setError("Backtest-förfrågan misslyckades.");
    } finally {
      setLoading(false);
    }
  }

  const sum = trend + momentum + volume;

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <section className="mx-auto max-w-4xl w-full px-4 sm:px-6 pt-12 pb-16 flex-1">
        <h1 className="font-serif font-bold text-3xl sm:text-4xl text-[var(--text-primary)] mb-2">
          Backtest-verktyg
        </h1>
        <p className="text-[var(--text-secondary)] mb-2 max-w-2xl flex items-center gap-2 flex-wrap">
          Vikta om trend, momentum och volym och se hur träffsäkerheten hade förändrats över
          riktig historisk prisdata.
          <button
            onClick={() => setShowMethodDetails((v) => !v)}
            className="text-[var(--accent)] hover:underline font-medium shrink-0"
          >
            {showMethodDetails ? "Visa mindre" : "Metod och begränsningar"}
          </button>
        </p>

        {showMethodDetails && (
          <div className="rounded-lg border border-[var(--surface-border)] bg-black/20 px-4 py-3 mb-4 text-xs text-[var(--text-secondary)] max-w-2xl leading-relaxed">
            <p className="mb-1.5">
              Varje signal &ldquo;handlas&rdquo; till nästa handelsdags öppningskurs, aldrig samma
              stängningskurs signalen räknades från — annars mäter man ett resultat man aldrig hade
              kunnat få i verkligheten. Kurserna är utdelningsjusterade så en aktie inte straffas
              för att den delar ut pengar, och en uppskattad kostnad (courtage, växlingsavgift,
              spread) dras av på varje affär.
            </p>
            <p>
              Aktieurvalet är dagens spårade bolag — delvis sådana som kända fondförvaltare äger —
              inte ett historiskt korrekt urval som även innehåller aktier som gått i konkurs eller
              avnoterats sedan dess. Det gör att resultatet sannolikt ser bättre ut här än vad en
              riktig, fristående strategi skulle prestera (survivorship bias). Gratis data med den
              bristen är ett känt, accepterat avsteg för det här verktyget just nu — inte något vi
              gömmer.
            </p>
          </div>
        )}
        <p className="text-xs font-mono text-[var(--text-muted)] mb-8">
          Vikterna är relativa till varandra, behöver inte summera till 100.
        </p>

        <div className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] p-5 mb-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
            <div ref={tickerBoxRef} className="relative">
              <label className="text-sm font-medium text-[var(--text-secondary)] block mb-1.5">
                Ticker
              </label>
              {/* Closed state: shows the real logo + name for whatever's
                  selected. Clicking it swaps in a search box so you filter
                  by ticker or company name instead of scrolling a 168-row
                  list blind. */}
              {tickerOpen ? (
                <input
                  autoFocus
                  value={tickerQuery}
                  onChange={(e) => setTickerQuery(e.target.value)}
                  placeholder="Sök ticker eller bolag…"
                  className="w-full bg-black/30 border border-[var(--accent)] rounded-md px-3 py-2 text-sm font-mono text-[var(--text-primary)] outline-none"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setTickerOpen(true)}
                  className="w-full flex items-center gap-2.5 bg-black/30 border border-[var(--surface-border)] rounded-md px-3 py-2 text-sm text-left outline-none focus:border-[var(--accent)] transition-colors hover:border-[var(--accent-dim)]"
                >
                  <CompanyLogo ticker={ticker} logoUrl={logoByTicker.get(ticker)} size={20} />
                  <span className="font-mono font-semibold text-[var(--text-primary)] shrink-0">{ticker}</span>
                  <span className="text-[var(--text-secondary)] truncate">
                    {selectedEntry?.name ?? ""}
                  </span>
                  <svg
                    viewBox="0 0 24 24"
                    className="h-4 w-4 text-[var(--text-muted)] ml-auto shrink-0"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              )}
              {tickerOpen && (
                <div className="absolute z-20 mt-1 w-full max-h-72 overflow-y-auto rounded-md border border-[var(--surface-border)] bg-[var(--surface)] shadow-lg">
                  {filteredUniverse.length === 0 ? (
                    <p className="px-4 py-3 text-sm text-[var(--text-muted)]">Inga träffar.</p>
                  ) : (
                    filteredUniverse.map((e) => (
                      <button
                        key={e.ticker}
                        type="button"
                        onClick={() => pickTicker(e.ticker)}
                        className={`w-full flex items-center gap-2.5 text-left px-3 py-2 hover:bg-black/30 transition-colors ${
                          e.ticker === ticker ? "bg-[rgba(111,176,224,0.08)]" : ""
                        }`}
                      >
                        <CompanyLogo ticker={e.ticker} logoUrl={logoByTicker.get(e.ticker)} size={20} />
                        <span className="font-mono font-semibold text-sm text-[var(--text-primary)] shrink-0">
                          {e.ticker}
                        </span>
                        <span className="text-xs text-[var(--text-secondary)] truncate">{e.name}</span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
            <div>
              <label className="text-sm font-medium text-[var(--text-secondary)] block mb-1.5">
                Period
              </label>
              <div className="flex gap-1 bg-black/30 rounded-md p-1 border border-[var(--surface-border)]">
                {RANGES.map((r) => (
                  <button
                    key={r}
                    onClick={() => setRange(r)}
                    className={`flex-1 py-1.5 rounded text-sm font-mono ${
                      range === r
                        ? "bg-[var(--surface-2)] text-[var(--text-primary)]"
                        : "text-[var(--text-secondary)]"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-2">
            {[
              {
                label: "Trend (vs 50-dagars snitt)",
                hint: "Stiger eller sjunker aktien just nu, jämfört med de senaste 50 dagarna?",
                value: trend,
                set: setTrend,
              },
              {
                label: "Momentum (RSI)",
                hint: "Har priset rört sig ovanligt snabbt nyligen — ett tecken på att det kan vara översålt eller överköpt?",
                value: momentum,
                set: setMomentum,
              },
              {
                label: "Volym",
                hint: "Handlas aktien med mer intresse (fler köp/sälj) än vanligt?",
                value: volume,
                set: setVolume,
              },
            ].map((w) => (
              <div key={w.label}>
                <label className="text-sm font-medium text-[var(--text-secondary)] flex items-baseline justify-between mb-1.5">
                  <span>{w.label}</span>
                  <span className="font-mono text-[var(--accent)] text-xs">{w.value}</span>
                </label>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={w.value}
                  onChange={(e) => w.set(Number(e.target.value))}
                  className="range-slider w-full"
                  style={{ "--range-fill": `${w.value}%` } as React.CSSProperties}
                />
                <p className="text-[11px] text-[var(--text-muted)] mt-1.5 leading-snug">{w.hint}</p>
              </div>
            ))}
          </div>
          <p className="text-xs font-mono text-[var(--text-muted)] mb-5">Summa: {sum}</p>

          <button
            onClick={run}
            disabled={loading}
            className="font-semibold text-sm rounded-md px-5 py-2.5 text-black shadow-[0_2px_10px_rgba(111,176,224,0.35)] hover:shadow-[0_4px_16px_rgba(111,176,224,0.45)] hover:-translate-y-0.5 active:translate-y-0 transition disabled:opacity-50 disabled:shadow-none disabled:translate-y-0"
            style={{ background: "linear-gradient(135deg, #9cd0f2, var(--accent) 65%, var(--accent-dim))" }}
          >
            {loading ? "Kör…" : "Kör backtest"}
          </button>
        </div>

        {error && (
          <div className="rounded-lg border border-[rgba(239,68,68,0.35)] bg-[rgba(239,68,68,0.08)] px-2.5 sm:px-4 py-3 text-sm text-[var(--red)] mb-8">
            {error}
          </div>
        )}

        {live && custom && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-lg border border-[var(--surface-border)] border-l-4 border-l-[var(--text-muted)] bg-[var(--surface)] p-5">
              <p className="text-xs font-mono tracking-widest text-[var(--text-muted)] mb-3">
                LIVE-VIKTER (40 / 30 / 30)
              </p>
              <p className="font-mono text-3xl font-bold text-[var(--text-primary)] mb-1">
                {live.hitRate !== null ? `${live.hitRate}%` : "—"}
              </p>
              <p className="text-xs text-[var(--text-secondary)]">
                {live.hits}/{live.evaluated} utvärderade signaler · {live.buySignalCount} köpsignaler
              </p>
            </div>
            <div className="rounded-lg border border-[rgba(111,176,224,0.3)] border-l-4 border-l-[var(--accent)] bg-[rgba(111,176,224,0.05)] p-5">
              <p className="text-xs font-mono tracking-widest text-[var(--accent)] mb-3">
                DINA VIKTER ({trend} / {momentum} / {volume})
              </p>
              <p className="font-mono text-3xl font-bold text-[var(--text-primary)] mb-1">
                {custom.hitRate !== null ? `${custom.hitRate}%` : "—"}
              </p>
              <p className="text-xs text-[var(--text-secondary)]">
                {custom.hits}/{custom.evaluated} utvärderade signaler · {custom.buySignalCount} köpsignaler
                {live.hitRate !== null && custom.hitRate !== null && (
                  <span className={custom.hitRate >= live.hitRate ? "text-[var(--green)]" : "text-[var(--red)]"}>
                    {" "}
                    ({formatPct(custom.hitRate - live.hitRate)} pts)
                  </span>
                )}
              </p>
            </div>
          </div>
        )}

        {custom && custom.rows.length > 0 && (
          <div className="mt-8">
            <p className="text-xs font-mono tracking-widest text-[var(--text-muted)] mb-3">
              SIGNALER MED DINA VIKTER
            </p>
            <div className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] overflow-hidden">
              <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--surface-border)] text-left text-xs font-mono tracking-widest text-[var(--text-muted)]">
                    <th className="px-2.5 sm:px-4 py-3 font-medium">SIGNALDATUM</th>
                    <th className="px-2.5 sm:px-4 py-3 font-medium">SIGNAL</th>
                    <th className="px-2.5 sm:px-4 py-3 font-medium text-right">POÄNG</th>
                    <th className="px-2.5 sm:px-4 py-3 font-medium">HANDLAD</th>
                    <th className="px-2.5 sm:px-4 py-3 font-medium text-right">TILL PRIS</th>
                    <th className="px-2.5 sm:px-4 py-3 font-medium text-right">UTFALL</th>
                  </tr>
                </thead>
                <tbody>
                  {custom.rows.map((r, i) => (
                    <tr key={i} className="border-b border-[var(--surface-border)] last:border-0">
                      <td className="px-2.5 sm:px-4 py-3 font-mono text-[var(--text-secondary)] whitespace-nowrap">{r.date}</td>
                      <td className="px-2.5 sm:px-4 py-3 font-mono text-[var(--text-primary)] whitespace-nowrap">{r.signal}</td>
                      <td className="px-2.5 sm:px-4 py-3 text-right font-mono text-[var(--text-secondary)]">{r.score}</td>
                      <td className="px-2.5 sm:px-4 py-3 font-mono text-[var(--text-secondary)] whitespace-nowrap">
                        {r.execDate ?? "ännu inte"}
                      </td>
                      <td className="px-2.5 sm:px-4 py-3 text-right font-mono text-[var(--text-secondary)] whitespace-nowrap">
                        {r.execPrice !== null ? `$${r.execPrice.toFixed(2)}` : "—"}
                      </td>
                      <td className="px-2.5 sm:px-4 py-3 text-right font-mono whitespace-nowrap">
                        {r.outcome === "hit" && <span className="text-[var(--green)]">TRÄFF</span>}
                        {r.outcome === "miss" && <span className="text-[var(--red)]">MISS</span>}
                        {!r.outcome && <span className="text-[var(--text-muted)]">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>
          </div>
        )}
      </section>

      <Footer />
    </div>
  );
}
