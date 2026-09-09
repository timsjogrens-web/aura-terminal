"use client";

import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { useQuotes } from "@/lib/useQuotes";
import { formatPct } from "@/lib/format";
import { Quote } from "@/lib/types";

const SECTOR_ORDER = ["Technology", "Financials", "Healthcare", "Energy", "Consumer"];

// Maps a change% to a background: brighter/more saturated the further
// from zero, capped so a single outlier doesn't wash out the rest of the
// grid. Green for gains, red for losses — same palette as the rest of
// the app (--green / --red custom properties).
function tileStyle(changePct: number | null): React.CSSProperties {
  if (changePct === null) {
    return { background: "var(--surface-2)" };
  }
  const magnitude = Math.min(Math.abs(changePct) / 5, 1); // 5%+ = full intensity
  const alpha = 0.12 + magnitude * 0.55;
  const color = changePct >= 0 ? "34,197,94" : "239,68,68"; // matches --green / --red
  return { background: `rgba(${color},${alpha})` };
}

function Tile({ quote }: { quote: Quote }) {
  return (
    <Link
      href={`/stock/${quote.ticker}`}
      style={tileStyle(quote.change_pct)}
      className="rounded-md border border-[var(--surface-border)] p-3 flex flex-col justify-between min-h-[84px] hover:border-[var(--gold-dim)] transition-colors"
    >
      <span className="font-mono font-bold text-sm text-[var(--text-primary)] whitespace-nowrap">
        {quote.ticker}
      </span>
      <span className="font-mono text-xs text-[var(--text-secondary)] whitespace-nowrap">
        {formatPct(quote.change_pct)}
      </span>
    </Link>
  );
}

export default function HeatmapPage() {
  const { data, loading } = useQuotes();
  const quotes = data?.quotes ?? [];

  const bySector = new Map<string, Quote[]>();
  for (const q of quotes) {
    const sector = q.sector ?? "Other";
    if (!bySector.has(sector)) bySector.set(sector, []);
    bySector.get(sector)!.push(q);
  }
  for (const list of bySector.values()) {
    list.sort((a, b) => (b.change_pct ?? -Infinity) - (a.change_pct ?? -Infinity));
  }

  const sectors = [
    ...SECTOR_ORDER.filter((s) => bySector.has(s)),
    ...Array.from(bySector.keys()).filter((s) => !SECTOR_ORDER.includes(s)),
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <section className="mx-auto max-w-6xl w-full px-4 sm:px-6 pt-12 pb-16 flex-1">
        <h1 className="font-serif font-bold text-3xl sm:text-4xl text-[var(--text-primary)] mb-2">
          Market Heatmap
        </h1>
        <p className="text-[var(--text-secondary)] mb-8 max-w-2xl">
          Every tracked stock, grouped by sector and colored by today&rsquo;s % change. Click any
          tile to open that stock.
        </p>

        {loading && <p className="text-[var(--text-muted)]">Loading…</p>}

        {!loading && sectors.length === 0 && (
          <p className="text-[var(--text-muted)]">No quote data available yet.</p>
        )}

        <div className="flex flex-col gap-8">
          {sectors.map((sector) => (
            <div key={sector}>
              <p className="text-xs font-mono tracking-widest text-[var(--text-muted)] mb-3">
                {sector.toUpperCase()}
              </p>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                {bySector.get(sector)!.map((q) => (
                  <Tile key={q.ticker} quote={q} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <Footer />
    </div>
  );
}
