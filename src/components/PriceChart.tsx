"use client";

import { useEffect, useState } from "react";
import { formatPrice } from "@/lib/format";

const RANGES = ["1D", "1W", "1M", "6M", "1Y", "5Y", "MAX"] as const;
type Range = (typeof RANGES)[number];

interface ChartData {
  timestamps: number[];
  closes: number[];
}

interface SignalMarker {
  timestamp: number; // unix seconds
  score: number | null;
  price: number | null;
}

const WIDTH = 800;
const HEIGHT = 280;
const PADDING = 32;

export default function PriceChart({ ticker }: { ticker: string }) {
  const [range, setRange] = useState<Range>("1M");
  const [data, setData] = useState<ChartData | null>(null);
  const [markers, setMarkers] = useState<SignalMarker[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`/api/chart?ticker=${ticker}&range=${range}`)
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return;
        if (json.error) {
          setError(json.error);
          setData(null);
        } else {
          setData({ timestamps: json.timestamps, closes: json.closes });
        }
      })
      .catch(() => {
        if (!cancelled) setError("Could not load chart data.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [ticker, range]);

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
        const strongBuys = rows
          .filter((r) => r.signal === "STRONG BUY")
          .map((r) => ({
            timestamp: Math.floor(new Date(r.timestamp).getTime() / 1000),
            score: r.score,
            price: r.price,
          }));
        setMarkers(strongBuys);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [ticker]);

  if (loading && !data) {
    return (
      <div className="h-[280px] flex items-center justify-center text-[var(--text-secondary)] text-sm">
        Loading chart…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div>
        <RangeSelector range={range} onChange={setRange} />
        <div className="h-[240px] flex items-center justify-center text-[var(--red)] text-sm">
          {error ?? "No chart data available."}
        </div>
      </div>
    );
  }

  const { timestamps, closes } = data;
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const priceRange = max - min || 1;
  const rising = closes[closes.length - 1] >= closes[0];
  const lineColor = rising ? "var(--green)" : "var(--red)";

  const xFor = (i: number) =>
    PADDING + (i / (timestamps.length - 1)) * (WIDTH - PADDING * 2);
  const yFor = (price: number) =>
    HEIGHT - PADDING - ((price - min) / priceRange) * (HEIGHT - PADDING * 2);

  const points = closes.map((c, i) => `${xFor(i).toFixed(1)},${yFor(c).toFixed(1)}`).join(" ");
  const areaPoints = `${PADDING},${HEIGHT - PADDING} ${points} ${WIDTH - PADDING},${HEIGHT - PADDING}`;

  const rangeStart = timestamps[0];
  // Yahoo's chart data can lag a few days behind, so a very recent signal
  // may fall after the last chart point — snap it to that point instead of
  // hiding it. Only signals from before the visible range are excluded.
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

  // Multiple signals can snap to the same nearest chart point (e.g. several
  // refresh cycles in a row, or Yahoo's data lagging behind); one dot per
  // point reads far more cleanly than several overlapping in the same spot.
  const markerIndices = Array.from(new Set(visibleMarkers.map((m) => closestIndex(m.timestamp))));

  return (
    <div>
      <RangeSelector range={range} onChange={setRange} />
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

        <polyline points={areaPoints} fill={lineColor} opacity={0.08} stroke="none" />
        <polyline points={points} fill="none" stroke={lineColor} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />

        {markerIndices.map((idx) => (
          <circle
            key={idx}
            cx={xFor(idx)}
            cy={yFor(closes[idx])}
            r={5}
            fill="var(--gold)"
            stroke="var(--background)"
            strokeWidth={1.5}
          />
        ))}
      </svg>
      {visibleMarkers.length > 0 && (
        <p className="text-xs font-mono text-[var(--text-secondary)] mt-2 flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-[var(--gold)] inline-block" />
          {visibleMarkers.length} STRONG BUY signal{visibleMarkers.length > 1 ? "s" : ""} in this range
        </p>
      )}
    </div>
  );
}

// "M" reads as "million" to plenty of people at a glance — spelling out
// the unit (1mo, 6mo) removes the ambiguity without needing more space.
const RANGE_LABELS: Record<Range, string> = {
  "1D": "1D",
  "1W": "1W",
  "1M": "1mo",
  "6M": "6mo",
  "1Y": "1Y",
  "5Y": "5Y",
  MAX: "MAX",
};

function RangeSelector({ range, onChange }: { range: Range; onChange: (r: Range) => void }) {
  return (
    <div className="flex gap-1 mb-3">
      {RANGES.map((r) => (
        <button
          key={r}
          onClick={() => onChange(r)}
          className={`text-xs font-mono rounded px-3 py-1.5 border transition ${
            range === r
              ? "border-[var(--gold)] text-[var(--gold)] bg-[rgba(245,165,36,0.08)]"
              : "border-[var(--surface-border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          }`}
        >
          {RANGE_LABELS[r]}
        </button>
      ))}
    </div>
  );
}
