"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

interface EquityPoint {
  date: string;
  value: number;
}

interface SimTrade {
  ticker: string;
  action: "BUY" | "SELL";
  shares: number;
  price: number;
  date: string;
  reason: string;
  returnPct: number | null;
}

interface TrackRecordData {
  equityCurve: EquityPoint[];
  spyEquityCurve: EquityPoint[];
  trades: SimTrade[];
  startDate: string;
  endDate: string;
  finalValue: number;
  totalReturnPct: number;
  spyTotalReturnPct: number;
  maxDrawdownPct: number;
  maxDrawdownPeakDate: string | null;
  maxDrawdownTroughDate: string | null;
  worstTrade: SimTrade | null;
  bestTrade: SimTrade | null;
  excludedTickers: string[];
  universeSize: number;
  generatedAt: string;
}

function formatSek(n: number): string {
  return n.toLocaleString("sv-SE", { maximumFractionDigits: 0 }) + " kr";
}

function formatPct(n: number): string {
  return `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
}

const WIDTH = 800;
const HEIGHT = 280;
const PADDING = 36;

function EquityChart({ data }: { data: TrackRecordData }) {
  // Both curves shown as % return from their own starting value, so a
  // dollar-scale mismatch (portfolio ramps up gradually as cash gets
  // deployed; SPY is fully invested from day one) doesn't distort the
  // comparison.
  const portfolioPct = data.equityCurve.map((p) => ({
    date: p.date,
    pct: ((p.value - 100_000) / 100_000) * 100,
  }));
  const spyPct = data.spyEquityCurve.map((p) => ({
    date: p.date,
    pct: ((p.value - 100_000) / 100_000) * 100,
  }));

  const allPcts = [...portfolioPct.map((p) => p.pct), ...spyPct.map((p) => p.pct)];
  const min = Math.min(0, ...allPcts);
  const max = Math.max(0, ...allPcts);
  const range = max - min || 1;

  const dateIndex = new Map(portfolioPct.map((p, i) => [p.date, i]));
  const n = portfolioPct.length;
  const xFor = (i: number) => PADDING + (i / Math.max(1, n - 1)) * (WIDTH - PADDING * 2);
  const yFor = (pct: number) => HEIGHT - PADDING - ((pct - min) / range) * (HEIGHT - PADDING * 2);
  const zeroY = yFor(0);

  const portfolioPoints = portfolioPct.map((p, i) => `${xFor(i).toFixed(1)},${yFor(p.pct).toFixed(1)}`).join(" ");
  const spyPoints = spyPct
    .map((p) => dateIndex.get(p.date))
    .map((i, j) => (i !== undefined ? `${xFor(i).toFixed(1)},${yFor(spyPct[j].pct).toFixed(1)}` : null))
    .filter((s): s is string => s !== null)
    .join(" ");

  const peakI = data.maxDrawdownPeakDate ? dateIndex.get(data.maxDrawdownPeakDate) : undefined;
  const troughI = data.maxDrawdownTroughDate ? dateIndex.get(data.maxDrawdownTroughDate) : undefined;

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full h-auto">
      <line x1={PADDING} y1={zeroY} x2={WIDTH - PADDING} y2={zeroY} stroke="var(--surface-border)" strokeWidth={1} strokeDasharray="4 4" />
      <text x={PADDING} y={zeroY - 4} fontSize="10" fill="var(--text-muted)" fontFamily="var(--font-mono)">
        0%
      </text>

      {peakI !== undefined && troughI !== undefined && (
        <rect
          x={xFor(peakI)}
          y={PADDING}
          width={Math.max(1, xFor(troughI) - xFor(peakI))}
          height={HEIGHT - PADDING * 2}
          fill="var(--red)"
          opacity={0.06}
        />
      )}

      {spyPoints && (
        <polyline points={spyPoints} fill="none" stroke="var(--text-muted)" strokeWidth={1.5} strokeDasharray="3 3" />
      )}
      <polyline points={portfolioPoints} fill="none" stroke="var(--gold)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />

      <g transform={`translate(${PADDING}, 14)`}>
        <line x1={0} y1={0} x2={16} y2={0} stroke="var(--gold)" strokeWidth={2} />
        <text x={20} y={3} fontSize="10" fill="var(--text-secondary)" fontFamily="var(--font-mono)">
          Signalportfölj
        </text>
        <line x1={120} y1={0} x2={136} y2={0} stroke="var(--text-muted)" strokeWidth={1.5} strokeDasharray="3 3" />
        <text x={140} y={3} fontSize="10" fill="var(--text-secondary)" fontFamily="var(--font-mono)">
          S&amp;P 500 (köp och behåll)
        </text>
      </g>
    </svg>
  );
}

export default function TrackRecordPage() {
  const [data, setData] = useState<TrackRecordData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/track-record")
      .then((r) => r.json())
      .then((json) => {
        if (json.error) setError(json.error);
        else setData(json);
      })
      .catch(() => setError("Kunde inte ladda track record."));
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <section className="mx-auto max-w-4xl w-full px-4 sm:px-6 pt-12 pb-16 flex-1">
        <h1 className="font-serif font-bold text-3xl sm:text-4xl text-[var(--text-primary)] mb-2">
          Vad hade hänt om du följt varje signal?
        </h1>
        <p className="text-[var(--text-secondary)] mb-4 max-w-2xl leading-relaxed">
          En fullständig historisk simulering — inte bara de bra perioderna. Samma regler som det
          riktiga papperskontot ($5 000 per ny STRONG BUY-signal, 8% stop-loss, trailing stop)
          körs mekaniskt över {data ? data.universeSize : "~170"} aktiers riktiga kurshistorik de
          senaste ~2 åren, med samma regel mot framtidsdataläckage som backtest-verktyget:
          varje beslut baseras bara på data fram till dagens stängning, och handlas tidigast
          nästa dags öppning.
        </p>

        <div className="rounded-lg border border-[var(--surface-border)] bg-black/20 px-4 py-3 mb-8 text-xs text-[var(--text-secondary)] max-w-2xl leading-relaxed">
          <p className="font-mono tracking-widest text-[var(--text-muted)] mb-1.5">BEGRÄNSNINGAR</p>
          <p>
            Samma aktielista och survivorship bias-problem som resten av sajten (se{" "}
            <Link href="/methodology" className="underline hover:text-[var(--text-primary)]">
              Metodik
            </Link>
            ) — dagens spårade bolag, inte en historiskt korrekt lista. Urvalet är dessutom
            delvis bolag som kända fondförvaltare äger (deras 13F-innehav), och bolag som
            ägs av framgångsrika investerare har i efterhand oftare gått bra — ett urval som
            kan få resultatet att se bättre ut än det borde. Stop-loss och trailing
            stop utvärderas här en gång per dag mot stängningskursen, medan det riktiga
            papperskontot kan reagera snabbare inom samma dag — om något är den här simuleringen
            alltså något långsammare att skydda en position än verkligheten, inte tvärtom.
          </p>
          <p className="mt-2">
            <strong>Om varför gränsen är STRONG BUY, inte BUY:</strong> vi testade hur resultatet
            förändras med hur högt poängen måste vara för att köpas, och en högre gräns gav
            genomgående bättre resultat i båda halvorna av den här 2-årsperioden. Men det är
            fortfarande samma två år som testas OCH visas här — inget bevis på hur det går
            framåt i tiden, bara den mest rigorösa kontroll den fria datan tillåter.
          </p>
        </div>

        {error && (
          <div className="rounded-lg border border-[rgba(239,68,68,0.35)] bg-[rgba(239,68,68,0.08)] px-4 py-3 text-sm text-[var(--red)] mb-8">
            {error}
          </div>
        )}

        {!data && !error && <p className="text-[var(--text-muted)]">Laddar — första gången kan ta en minut eller två…</p>}

        {data && (
          <>
            <div className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] p-5 mb-6">
              <EquityChart data={data} />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
              <div className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] p-4">
                <p className="text-xs font-mono tracking-widest text-[var(--text-muted)] mb-1">AVKASTNING</p>
                <p className={`font-mono text-xl font-bold ${data.totalReturnPct >= 0 ? "text-[var(--green)]" : "text-[var(--red)]"}`}>
                  {formatPct(data.totalReturnPct)}
                </p>
              </div>
              <div className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] p-4">
                <p className="text-xs font-mono tracking-widest text-[var(--text-muted)] mb-1">S&amp;P 500</p>
                <p className={`font-mono text-xl font-bold ${data.spyTotalReturnPct >= 0 ? "text-[var(--green)]" : "text-[var(--red)]"}`}>
                  {formatPct(data.spyTotalReturnPct)}
                </p>
              </div>
              <div className="rounded-lg border border-[rgba(239,68,68,0.3)] bg-[rgba(239,68,68,0.05)] p-4">
                <p className="text-xs font-mono tracking-widest text-[var(--text-muted)] mb-1">STÖRSTA NEDGÅNGEN</p>
                <p className="font-mono text-xl font-bold text-[var(--red)]">{formatPct(data.maxDrawdownPct)}</p>
              </div>
              <div className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] p-4">
                <p className="text-xs font-mono tracking-widest text-[var(--text-muted)] mb-1">SLUTVÄRDE</p>
                <p className="font-mono text-xl font-bold text-[var(--text-primary)]">{formatSek(data.finalValue)}</p>
              </div>
            </div>

            {data.maxDrawdownPeakDate && data.maxDrawdownTroughDate && (
              <div className="rounded-lg border border-[rgba(239,68,68,0.3)] bg-[rgba(239,68,68,0.04)] p-5 mb-8">
                <p className="text-xs font-mono tracking-widest text-[var(--red)] mb-2">DEN SÄMSTA PERIODEN</p>
                <p className="text-sm text-[var(--text-secondary)]">
                  Portföljen föll {Math.abs(data.maxDrawdownPct).toFixed(1)}% mellan{" "}
                  <span className="text-[var(--text-primary)] font-mono">{data.maxDrawdownPeakDate}</span> och{" "}
                  <span className="text-[var(--text-primary)] font-mono">{data.maxDrawdownTroughDate}</span> — markerat i
                  rött i grafen ovan. Ingen strategi går uppåt i en rak linje, och den här var
                  inget undantag.
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
              {data.worstTrade && (
                <div className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] p-5">
                  <p className="text-xs font-mono tracking-widest text-[var(--text-muted)] mb-2">SÄMSTA ENSKILDA AFFÄR</p>
                  <p className="font-mono font-semibold text-[var(--text-primary)]">{data.worstTrade.ticker}</p>
                  <p className="font-mono text-2xl font-bold text-[var(--red)]">
                    {formatPct(data.worstTrade.returnPct ?? 0)}
                  </p>
                  <p className="text-xs text-[var(--text-muted)] mt-1">Såld {data.worstTrade.date} · {data.worstTrade.reason}</p>
                </div>
              )}
              {data.bestTrade && (
                <div className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] p-5">
                  <p className="text-xs font-mono tracking-widest text-[var(--text-muted)] mb-2">BÄSTA ENSKILDA AFFÄR</p>
                  <p className="font-mono font-semibold text-[var(--text-primary)]">{data.bestTrade.ticker}</p>
                  <p className="font-mono text-2xl font-bold text-[var(--green)]">
                    {formatPct(data.bestTrade.returnPct ?? 0)}
                  </p>
                  <p className="text-xs text-[var(--text-muted)] mt-1">Såld {data.bestTrade.date} · {data.bestTrade.reason}</p>
                </div>
              )}
            </div>

            {data.excludedTickers.length > 0 && (
              <p className="text-xs text-[var(--text-muted)] mb-4">
                Kunde inte hämta historik för: {data.excludedTickers.join(", ")} — uteslutna ur simuleringen.
              </p>
            )}

            <p className="text-xs text-[var(--text-muted)]">
              Simulerad period: {data.startDate} till {data.endDate}. Beräknad{" "}
              {new Date(data.generatedAt).toLocaleString("sv-SE")}.
            </p>
          </>
        )}
      </section>

      <Footer />
    </div>
  );
}
