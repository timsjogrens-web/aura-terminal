"use client";

import { useEffect, useMemo, useState } from "react";
import { formatPrice } from "@/lib/format";

const RANGES = ["1D", "1W", "1M", "3M", "6M", "YTD", "1Y", "3Y", "5Y"] as const;
type Range = (typeof RANGES)[number];

interface ChartData {
  timestamps: number[];
  closes: number[];
  opens: number[];
  highs: number[];
  lows: number[];
}

type ChartType = "line" | "candles";
const CHART_TYPE_KEY = "aura_chart_type";

interface SignalMarker {
  timestamp: number; // unix seconds
  score: number | null;
  price: number | null;
}

const WIDTH = 800;
const HEIGHT = 280;
const PADDING = 32;

const DAYS_AGO: Partial<Record<Range, number>> = {
  "1W": 7,
  "1M": 30,
  "3M": 91,
  "6M": 182,
  "1Y": 365,
  "3Y": 365 * 3,
};

function sliceFrom(series: ChartData, idx: number): ChartData {
  return {
    timestamps: series.timestamps.slice(idx),
    closes: series.closes.slice(idx),
    opens: series.opens.slice(idx),
    highs: series.highs.slice(idx),
    lows: series.lows.slice(idx),
  };
}

function sliceByDaysAgo(series: ChartData, daysAgo: number): ChartData {
  if (series.timestamps.length === 0) return series;
  const nowTs = series.timestamps[series.timestamps.length - 1];
  const targetTs = nowTs - daysAgo * 86400;
  const startIdx = series.timestamps.findIndex((t) => t >= targetTs);
  return sliceFrom(series, startIdx === -1 ? 0 : startIdx);
}

function sliceByYTD(series: ChartData): ChartData {
  if (series.timestamps.length === 0) return series;
  const now = new Date(series.timestamps[series.timestamps.length - 1] * 1000);
  const jan1 = Date.UTC(now.getUTCFullYear(), 0, 1) / 1000;
  const startIdx = series.timestamps.findIndex((t) => t >= jan1);
  return sliceFrom(series, startIdx === -1 ? 0 : startIdx);
}

function pctChange(series: ChartData | null): number | null {
  if (!series || series.closes.length < 2) return null;
  const start = series.closes[0];
  const end = series.closes[series.closes.length - 1];
  if (!start) return null;
  return ((end - start) / start) * 100;
}

async function fetchSeries(ticker: string, range: string): Promise<ChartData | null> {
  const res = await fetch(`/api/chart?ticker=${ticker}&range=${range}`);
  const json = await res.json();
  if (json.error) return null;
  // opens/highs/lows are missing only for the rare bar the API already
  // dropped for incomplete OHLC — same-length arrays are guaranteed by
  // getChartSeries. Falling back to closes here is just a type-safety
  // backstop, not something expected to actually trigger.
  return {
    timestamps: json.timestamps,
    closes: json.closes,
    opens: json.opens ?? json.closes,
    highs: json.highs ?? json.closes,
    lows: json.lows ?? json.closes,
  };
}

export default function PriceChart({
  ticker,
  changePct,
}: {
  ticker: string;
  changePct?: number | null;
}) {
  const [range, setRange] = useState<Range>("1M");
  const [chartType, setChartType] = useState<ChartType>("line");

  useEffect(() => {
    const saved = localStorage.getItem(CHART_TYPE_KEY);
    if (saved === "line" || saved === "candles") setChartType(saved);
  }, []);

  function changeChartType(next: ChartType) {
    setChartType(next);
    localStorage.setItem(CHART_TYPE_KEY, next);
  }

  // "Medium" (1y daily) and "long" (5y weekly) are fetched once per ticker;
  // every range except 1D/1W is derived from them locally (instant, no
  // refetch on click). 1D/1W need finer intraday granularity those two
  // series don't have, so they're fetched on demand instead.
  const [mediumSeries, setMediumSeries] = useState<ChartData | null>(null);
  const [longSeries, setLongSeries] = useState<ChartData | null>(null);
  const [intradaySeries, setIntradaySeries] = useState<ChartData | null>(null);
  const [intradayRange, setIntradayRange] = useState<Range | null>(null);
  const [markers, setMarkers] = useState<SignalMarker[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([fetchSeries(ticker, "1Y"), fetchSeries(ticker, "5Y")])
      .then(([medium, long]) => {
        if (cancelled) return;
        if (!medium && !long) {
          setError("Kunde inte ladda diagramdata.");
        } else {
          setMediumSeries(medium);
          setLongSeries(long);
        }
      })
      .catch(() => {
        if (!cancelled) setError("Kunde inte ladda diagramdata.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [ticker]);

  useEffect(() => {
    if (range !== "1D" && range !== "1W") return;
    if (intradayRange === range) return;
    let cancelled = false;
    fetchSeries(ticker, range).then((series) => {
      if (cancelled) return;
      if (series) {
        setIntradaySeries(series);
        setIntradayRange(range);
      } else {
        setError("Kunde inte ladda diagramdata för denna period.");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [range, ticker, intradayRange]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/history?ticker=${ticker}`)
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return;
        const rows = (json.rows ?? []) as {
          signal: string | null;
          timestamp: string;
          score: number | null;
          price: number | null;
        }[];
        setMarkers(
          rows
            .filter((r) => r.signal === "STRONG BUY")
            .map((r) => ({
              timestamp: Math.floor(new Date(r.timestamp).getTime() / 1000),
              score: r.score,
              price: r.price,
            }))
        );
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [ticker]);

  const displayData: ChartData | null = useMemo(() => {
    if (range === "1D" || range === "1W") {
      return intradayRange === range ? intradaySeries : null;
    }
    if (range === "YTD") return mediumSeries ? sliceByYTD(mediumSeries) : null;
    if (range === "3Y" || range === "5Y") return longSeries;
    if (!mediumSeries) return null;
    const days = DAYS_AGO[range];
    return days ? sliceByDaysAgo(mediumSeries, days) : mediumSeries;
  }, [range, mediumSeries, longSeries, intradaySeries, intradayRange]);

  const rangePercents = useMemo(() => {
    const out: Partial<Record<Range, number | null>> = { "1D": changePct ?? null };
    if (mediumSeries) {
      out["1W"] = pctChange(sliceByDaysAgo(mediumSeries, 7));
      out["1M"] = pctChange(sliceByDaysAgo(mediumSeries, 30));
      out["3M"] = pctChange(sliceByDaysAgo(mediumSeries, 91));
      out["6M"] = pctChange(sliceByDaysAgo(mediumSeries, 182));
      out.YTD = pctChange(sliceByYTD(mediumSeries));
      out["1Y"] = pctChange(mediumSeries);
    }
    if (longSeries) {
      out["3Y"] = pctChange(sliceByDaysAgo(longSeries, 365 * 3));
      out["5Y"] = pctChange(longSeries);
    }
    return out;
  }, [mediumSeries, longSeries, changePct]);

  if (loading && !mediumSeries && !longSeries) {
    return (
      <div className="h-[280px] flex items-center justify-center text-[var(--text-secondary)] text-sm">
        Laddar diagram…
      </div>
    );
  }

  if (error && !displayData) {
    return <div className="h-[240px] flex items-center justify-center text-[var(--red)] text-sm">{error}</div>;
  }

  if (!displayData || displayData.closes.length < 2) {
    return (
      <div>
        <div className="h-[240px] flex items-center justify-center text-[var(--text-secondary)] text-sm">
          Laddar…
        </div>
        <RangeSelector range={range} onChange={setRange} percents={rangePercents} />
      </div>
    );
  }

  const { timestamps, closes, opens, highs, lows } = displayData;
  // Scale off highs/lows (not just closes) so candle wicks are never
  // clipped — and so the price axis doesn't jump when toggling chart type.
  const min = Math.min(...lows);
  const max = Math.max(...highs);
  const priceRange = max - min || 1;
  const rising = closes[closes.length - 1] >= closes[0];
  const lineColor = rising ? "var(--green)" : "var(--red)";

  const xFor = (i: number) => PADDING + (i / (timestamps.length - 1)) * (WIDTH - PADDING * 2);
  const yFor = (price: number) => HEIGHT - PADDING - ((price - min) / priceRange) * (HEIGHT - PADDING * 2);

  const points = closes.map((c, i) => `${xFor(i).toFixed(1)},${yFor(c).toFixed(1)}`).join(" ");
  const areaPoints = `${PADDING},${HEIGHT - PADDING} ${points} ${WIDTH - PADDING},${HEIGHT - PADDING}`;

  // Candle body width: a fraction of the space between two bars, capped so
  // a short range (few bars) doesn't produce absurdly fat candles.
  const stepWidth = (WIDTH - PADDING * 2) / Math.max(timestamps.length - 1, 1);
  const candleWidth = Math.max(1, Math.min(stepWidth * 0.6, 10));

  const rangeStart = timestamps[0];
  const visibleMarkers = markers.filter((m) => m.timestamp >= rangeStart);

  function closestIndex(ts: number): number {
    let best = 0;
    let bestDiff = Infinity;
    for (let i = 0; i < timestamps.length; i++) {
      const diff = Math.abs(timestamps[i] - ts);
      if (diff < bestDiff) {
        bestDiff = diff;
        best = i;
      }
    }
    return best;
  }

  // Several signal snapshots (e.g. many refresh cycles in one day) can
  // snap to the same nearest chart point — group them so the tooltip can
  // show exactly when it was first (and how many times it was) called.
  const markersByIndex = new Map<number, SignalMarker[]>();
  for (const m of visibleMarkers) {
    const idx = closestIndex(m.timestamp);
    if (!markersByIndex.has(idx)) markersByIndex.set(idx, []);
    markersByIndex.get(idx)!.push(m);
  }
  const markerIndices = Array.from(markersByIndex.keys());

  function formatMarkerTooltip(idx: number): string {
    const group = markersByIndex.get(idx) ?? [];
    const sorted = [...group].sort((a, b) => a.timestamp - b.timestamp);
    const first = sorted[0];
    const dateStr = first ? new Date(first.timestamp * 1000).toLocaleString() : "";
    const priceStr = first?.price != null ? `$${formatPrice(first.price)}` : "";
    const extra = sorted.length > 1 ? ` (+${sorted.length - 1} gång${sorted.length > 2 ? "er" : ""} till sedan dess)` : "";
    return `STRONG BUY gavs ${dateStr} vid ${priceStr}${extra}`;
  }

  return (
    <div>
      <div className="flex justify-end mb-2">
        <div className="flex gap-1 bg-black/30 rounded-md p-1 border border-[var(--surface-border)]">
          <button
            onClick={() => changeChartType("line")}
            className={`px-3 py-1 rounded text-xs font-mono font-semibold transition ${
              chartType === "line" ? "bg-[var(--surface-2)] text-[var(--text-primary)]" : "text-[var(--text-secondary)]"
            }`}
          >
            Linje
          </button>
          <button
            onClick={() => changeChartType("candles")}
            className={`px-3 py-1 rounded text-xs font-mono font-semibold transition ${
              chartType === "candles" ? "bg-[var(--surface-2)] text-[var(--text-primary)]" : "text-[var(--text-secondary)]"
            }`}
          >
            Candlestick
          </button>
        </div>
      </div>

      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full h-auto">
        <text x={PADDING} y={16} fontSize="11" fill="var(--text-muted)" fontFamily="var(--font-mono)">
          ${formatPrice(max)}
        </text>
        <text
          x={PADDING}
          y={HEIGHT - PADDING + 16}
          fontSize="11"
          fill="var(--text-muted)"
          fontFamily="var(--font-mono)"
        >
          ${formatPrice(min)}
        </text>

        {chartType === "line" ? (
          <>
            <polyline points={areaPoints} fill={lineColor} opacity={0.08} stroke="none" />
            <polyline points={points} fill="none" stroke={lineColor} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </>
        ) : (
          closes.map((c, i) => {
            const o = opens[i];
            const h = highs[i];
            const l = lows[i];
            const up = c >= o;
            const color = up ? "var(--green)" : "var(--red)";
            const bodyTop = yFor(Math.max(o, c));
            const bodyBottom = yFor(Math.min(o, c));
            const x = xFor(i);
            return (
              <g key={i}>
                <line x1={x} x2={x} y1={yFor(h)} y2={yFor(l)} stroke={color} strokeWidth={1} />
                <rect
                  x={x - candleWidth / 2}
                  y={bodyTop}
                  width={candleWidth}
                  height={Math.max(bodyBottom - bodyTop, 1)}
                  fill={color}
                />
              </g>
            );
          })
        )}

        {markerIndices.map((idx) => (
          <circle
            key={idx}
            cx={xFor(idx)}
            cy={yFor(closes[idx])}
            r={6}
            fill="var(--gold)"
            stroke="var(--background)"
            strokeWidth={1.5}
            className="cursor-help"
          >
            <title>{formatMarkerTooltip(idx)}</title>
          </circle>
        ))}
      </svg>

      {visibleMarkers.length > 0 && (
        <div className="text-xs font-mono text-[var(--text-secondary)] mt-2 mb-1 space-y-1">
          <p className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[var(--gold)] inline-block" />
            {visibleMarkers.length} STRONG BUY-signal{visibleMarkers.length > 1 ? "er" : ""} i denna period
            <span className="hidden sm:inline text-[var(--text-muted)]">— hovra över en guldprick för exakt tid</span>
          </p>
          <p className="text-[var(--text-muted)]">
            Senaste:{" "}
            <span className="text-[var(--text-secondary)]">
              {new Date(
                Math.max(...visibleMarkers.map((m) => m.timestamp)) * 1000
              ).toLocaleString()}
            </span>
          </p>
        </div>
      )}

      <RangeSelector range={range} onChange={setRange} percents={rangePercents} />
    </div>
  );
}

// Kept short on purpose. Spelling "1 Month" out fully didn't stop browser
// translation from mangling it (Swedish finance shorthand treats "M" as
// "miljon" regardless of wording) — writing YTD in Swedish directly at
// least gives the translator nothing left to substitute.
const RANGE_LABELS: Record<Range, string> = {
  "1D": "1D",
  "1W": "1W",
  "1M": "1M",
  "3M": "3M",
  "6M": "6M",
  YTD: "I ÅR",
  "1Y": "1Y",
  "3Y": "3Y",
  "5Y": "5Y",
};

function RangeSelector({
  range,
  onChange,
  percents,
}: {
  range: Range;
  onChange: (r: Range) => void;
  percents: Partial<Record<Range, number | null>>;
}) {
  return (
    <div className="flex flex-wrap gap-1 mt-3 pt-3 border-t border-[var(--surface-border)]">
      {RANGES.map((r) => {
        const pct = percents[r];
        return (
          <button
            key={r}
            onClick={() => onChange(r)}
            className={`flex flex-col items-center gap-0.5 rounded px-2.5 py-1.5 border transition whitespace-nowrap ${
              range === r
                ? "border-[var(--gold)] bg-[rgba(245,165,36,0.08)]"
                : "border-transparent hover:border-[var(--surface-border)]"
            }`}
          >
            <span
              className={`text-xs font-mono ${
                range === r ? "text-[var(--gold)]" : "text-[var(--text-secondary)]"
              }`}
            >
              {RANGE_LABELS[r]}
            </span>
            <span
              className={`text-xs font-mono whitespace-nowrap ${
                pct === null || pct === undefined
                  ? "text-[var(--text-muted)]"
                  : pct >= 0
                  ? "text-[var(--green)]"
                  : "text-[var(--red)]"
              }`}
            >
              {pct === null || pct === undefined ? "—" : `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`}
            </span>
          </button>
        );
      })}
    </div>
  );
}
