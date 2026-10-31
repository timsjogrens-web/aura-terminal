"use client";

import { useState } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

function formatSek(n: number): string {
  return n.toLocaleString("sv-SE", { maximumFractionDigits: 0 }) + " kr";
}

export default function RiskCalculatorPage() {
  const [portfolioValue, setPortfolioValue] = useState(100_000);
  const [riskPct, setRiskPct] = useState(1);
  const [entryPrice, setEntryPrice] = useState(100);
  const [stopPrice, setStopPrice] = useState(92);

  const riskPerShare = Math.max(entryPrice - stopPrice, 0);
  const maxLossAmount = (portfolioValue * riskPct) / 100;
  const suggestedShares = riskPerShare > 0 ? Math.floor(maxLossAmount / riskPerShare) : 0;
  const positionSize = suggestedShares * entryPrice;
  const positionPctOfPortfolio = portfolioValue > 0 ? (positionSize / portfolioValue) * 100 : 0;
  const stopLossPctBelowEntry = entryPrice > 0 ? (riskPerShare / entryPrice) * 100 : 0;

  const isConcentrated = positionPctOfPortfolio > 25;
  const isInvalid = entryPrice <= 0 || stopPrice >= entryPrice || portfolioValue <= 0;

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <section className="mx-auto max-w-2xl w-full px-4 sm:px-6 pt-12 pb-20 flex-1">
        <h1 className="font-serif font-bold text-3xl sm:text-4xl text-[var(--text-primary)] mb-2">
          Riskkalkylator
        </h1>
        <p className="text-[var(--text-secondary)] mb-8 max-w-xl leading-relaxed">
          Räknar ut en rimlig positionsstorlek utifrån hur mycket du är beredd att förlora på en
          enskild affär &mdash; inte utifrån hur mycket du &ldquo;känner för&rdquo; att köpa. Det
          här är den enskilt vanligaste orsaken till stora förluster hos privatpersoner: för stor
          position i en enda aktie.
        </p>

        <div className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] p-5 mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
            <div>
              <label className="text-sm font-medium text-[var(--text-secondary)] block mb-1.5">
                Portföljvärde
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={portfolioValue}
                  onChange={(e) => setPortfolioValue(Number(e.target.value))}
                  className="w-full bg-black/30 border border-[var(--surface-border)] rounded-md px-3 pr-9 py-2 text-sm font-mono text-[var(--text-primary)] outline-none focus:border-[var(--accent)] transition-colors"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono text-[var(--text-muted)] pointer-events-none">
                  kr
                </span>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-[var(--text-secondary)] flex items-baseline justify-between mb-1.5">
                <span>Max risk per affär</span>
                <span className="font-mono text-[var(--accent)] text-xs">{riskPct}%</span>
              </label>
              <input
                type="range"
                min={0.25}
                max={5}
                step={0.25}
                value={riskPct}
                onChange={(e) => setRiskPct(Number(e.target.value))}
                className="range-slider w-full mt-2.5"
                style={{ "--range-fill": `${((riskPct - 0.25) / (5 - 0.25)) * 100}%` } as React.CSSProperties}
              />
              <p className="text-[11px] text-[var(--text-muted)] mt-1">
                De flesta professionella riktlinjer ligger mellan 0,5&ndash;2%.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-[var(--text-secondary)] block mb-1.5">
                Ingångskurs
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={entryPrice}
                  onChange={(e) => setEntryPrice(Number(e.target.value))}
                  className="w-full bg-black/30 border border-[var(--surface-border)] rounded-md px-3 pr-9 py-2 text-sm font-mono text-[var(--text-primary)] outline-none focus:border-[var(--accent)] transition-colors"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono text-[var(--text-muted)] pointer-events-none">
                  kr
                </span>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-[var(--text-secondary)] block mb-1.5">
                Stop-loss kurs
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={stopPrice}
                  onChange={(e) => setStopPrice(Number(e.target.value))}
                  className="w-full bg-black/30 border border-[var(--surface-border)] rounded-md px-3 pr-9 py-2 text-sm font-mono text-[var(--text-primary)] outline-none focus:border-[var(--accent)] transition-colors"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono text-[var(--text-muted)] pointer-events-none">
                  kr
                </span>
              </div>
            </div>
          </div>
        </div>

        {isInvalid ? (
          <div className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] p-5 text-sm text-[var(--text-secondary)]">
            Stop-loss måste vara lägre än ingångskursen, och portföljvärdet större än 0.
          </div>
        ) : (
          <>
            <div className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] p-5 mb-6">
              <p className="font-mono text-xs tracking-widest text-[var(--text-muted)] mb-4">RESULTAT</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div className="rounded-md border-l-[3px] border-l-[var(--accent)] bg-black/20 p-3">
                  <p className="text-[var(--text-muted)] mb-0.5">Rekommenderat antal aktier</p>
                  <p className="font-mono text-2xl font-bold text-[var(--accent)]">{suggestedShares}</p>
                </div>
                <div className="rounded-md border-l-[3px] border-l-[var(--surface-border)] bg-black/20 p-3">
                  <p className="text-[var(--text-muted)] mb-0.5">Positionens värde</p>
                  <p className="font-mono text-lg text-[var(--text-primary)]">{formatSek(positionSize)}</p>
                </div>
                <div
                  className={`rounded-md border-l-[3px] bg-black/20 p-3 ${
                    isConcentrated ? "border-l-[var(--red)]" : "border-l-[var(--surface-border)]"
                  }`}
                >
                  <p className="text-[var(--text-muted)] mb-0.5">Andel av portföljen</p>
                  <p className={`font-mono text-lg ${isConcentrated ? "text-[var(--red)]" : "text-[var(--text-primary)]"}`}>
                    {positionPctOfPortfolio.toFixed(1)}%
                  </p>
                </div>
                <div className="rounded-md border-l-[3px] border-l-[var(--surface-border)] bg-black/20 p-3">
                  <p className="text-[var(--text-muted)] mb-0.5">Max förlust om stop-loss triggas</p>
                  <p className="font-mono text-lg text-[var(--text-primary)]">
                    {formatSek(suggestedShares * riskPerShare)}
                  </p>
                </div>
              </div>
              <p className="text-xs text-[var(--text-muted)] mt-4">
                Stop-loss ligger {stopLossPctBelowEntry.toFixed(1)}% under ingångskursen.
              </p>
            </div>

            {isConcentrated && (
              <div className="rounded-lg border border-[var(--red)]/40 bg-[rgba(220,60,60,0.08)] p-4 text-sm text-[var(--text-primary)] mb-6">
                <strong>Koncentrationsrisk:</strong> den här positionen skulle bli{" "}
                {positionPctOfPortfolio.toFixed(0)}% av hela portföljen. Om aktien rör sig kraftigt
                mot din stop-loss (t.ex. vid en oväntad nyhet över natten, då stop-loss inte alltid
                hinner triggas till rätt pris) slår det hårt mot hela din portfölj. Överväg att sprida
                risken över fler bolag och branscher istället.
              </div>
            )}
          </>
        )}

        <div className="rounded-lg border border-[var(--surface-border)] bg-black/20 px-4 py-3 text-xs text-[var(--text-secondary)] leading-relaxed">
          <p className="font-mono tracking-widest text-[var(--text-muted)] mb-1.5">SÅ HÄR TÄNKER VERKTYGET</p>
          <p>
            Istället för att fråga &ldquo;hur många aktier har jag råd att köpa&rdquo; frågar
            verktyget &ldquo;hur mycket är jag beredd att förlora om jag har fel&rdquo; och räknar
            baklänges till antal aktier. Det håller en enskild felbedömning från att bli en
            portföljkatastrof &mdash; oavsett vad någon signal eller poäng på den här sajten säger.
          </p>
        </div>
      </section>

      <Footer />
    </div>
  );
}
