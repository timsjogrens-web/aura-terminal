"use client";

import { useState } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { DEFAULT_UNIVERSE } from "@/lib/universe";
import { formatPct } from "@/lib/format";

interface BacktestRow {
  date: string;
  price: number;
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
      setError("Backtest request failed.");
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
          Backtest Strategy Builder
        </h1>
        <p className="text-[var(--text-secondary)] mb-8 max-w-2xl">
          Re-weight trend, momentum, and volume and see how the hit rate would have changed over
          real historical price data — compared side by side with the live 40/30/30 weighting.
          Weights are relative to each other, not required to sum to 100.
        </p>

        <div className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] p-5 mb-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
            <div>
              <label className="text-xs font-mono tracking-widest text-[var(--text-muted)] block mb-1.5">
                TICKER
              </label>
              <select
                value={ticker}
                onChange={(e) => setTicker(e.target.value)}
                className="w-full bg-black/30 border border-[var(--surface-border)] rounded-md px-3 py-2 text-sm font-mono text-[var(--text-primary)]"
              >
                {DEFAULT_UNIVERSE.map((e) => (
                  <option key={e.ticker} value={e.ticker}>
                    {e.ticker} — {e.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-mono tracking-widest text-[var(--text-muted)] block mb-1.5">
                RANGE
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
              { label: "TREND (vs 50-day avg)", value: trend, set: setTrend },
              { label: "MOMENTUM (RSI)", value: momentum, set: setMomentum },
              { label: "VOLUME", value: volume, set: setVolume },
            ].map((w) => (
              <div key={w.label}>
                <label className="text-xs font-mono tracking-widest text-[var(--text-muted)] block mb-1.5">
                  {w.label} · {w.value}
                </label>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={w.value}
                  onChange={(e) => w.set(Number(e.target.value))}
                  className="w-full accent-[var(--gold)]"
                />
              </div>
            ))}
          </div>
          <p className="text-xs font-mono text-[var(--text-muted)] mb-5">Sum: {sum}</p>

          <button
            onClick={run}
            disabled={loading}
            className="bg-[var(--gold)] text-black font-semibold text-sm rounded-md px-4 py-2 hover:opacity-90 transition disabled:opacity-50"
          >
            {loading ? "Running…" : "Run Backtest"}
          </button>
        </div>

        {error && (
          <div className="rounded-lg border border-[rgba(239,68,68,0.35)] bg-[rgba(239,68,68,0.08)] px-2.5 sm:px-4 py-3 text-sm text-[var(--red)] mb-8">
            {error}
          </div>
        )}

        {live && custom && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] p-5">
              <p className="text-xs font-mono tracking-widest text-[var(--text-muted)] mb-3">
                LIVE WEIGHTS (40 / 30 / 30)
              </p>
              <p className="font-mono text-3xl font-bold text-[var(--text-primary)] mb-1">
                {live.hitRate !== null ? `${live.hitRate}%` : "—"}
              </p>
              <p className="text-xs text-[var(--text-secondary)]">
                {live.hits}/{live.evaluated} calls evaluated · {live.buySignalCount} buy signals
              </p>
            </div>
            <div className="rounded-lg border border-[rgba(245,165,36,0.3)] bg-[rgba(245,165,36,0.05)] p-5">
              <p className="text-xs font-mono tracking-widest text-[var(--gold)] mb-3">
                YOUR WEIGHTS ({trend} / {momentum} / {volume})
              </p>
              <p className="font-mono text-3xl font-bold text-[var(--text-primary)] mb-1">
                {custom.hitRate !== null ? `${custom.hitRate}%` : "—"}
              </p>
              <p className="text-xs text-[var(--text-secondary)]">
                {custom.hits}/{custom.evaluated} calls evaluated · {custom.buySignalCount} buy signals
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
              SIGNALS UNDER YOUR WEIGHTS
            </p>
            <div className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] overflow-hidden">
              <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--surface-border)] text-left text-xs font-mono tracking-widest text-[var(--text-muted)]">
                    <th className="px-2.5 sm:px-4 py-3 font-medium">DATE</th>
                    <th className="px-2.5 sm:px-4 py-3 font-medium">SIGNAL</th>
                    <th className="px-2.5 sm:px-4 py-3 font-medium text-right">SCORE</th>
                    <th className="px-2.5 sm:px-4 py-3 font-medium text-right">PRICE</th>
                    <th className="px-2.5 sm:px-4 py-3 font-medium text-right">OUTCOME</th>
                  </tr>
                </thead>
                <tbody>
                  {custom.rows.map((r, i) => (
                    <tr key={i} className="border-b border-[var(--surface-border)] last:border-0">
                      <td className="px-2.5 sm:px-4 py-3 font-mono text-[var(--text-secondary)] whitespace-nowrap">{r.date}</td>
                      <td className="px-2.5 sm:px-4 py-3 font-mono text-[var(--text-primary)] whitespace-nowrap">{r.signal}</td>
                      <td className="px-2.5 sm:px-4 py-3 text-right font-mono text-[var(--text-secondary)]">{r.score}</td>
                      <td className="px-2.5 sm:px-4 py-3 text-right font-mono text-[var(--text-secondary)] whitespace-nowrap">
                        ${r.price.toFixed(2)}
                      </td>
                      <td className="px-2.5 sm:px-4 py-3 text-right font-mono whitespace-nowrap">
                        {r.outcome === "hit" && <span className="text-[var(--green)]">HIT</span>}
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
