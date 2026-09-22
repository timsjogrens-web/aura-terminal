"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import CompanyLogo from "@/components/CompanyLogo";
import { useAuthStatus } from "@/lib/useAuthStatus";
import { formatPct, formatPrice, timeAgo } from "@/lib/format";

interface Position {
  ticker: string;
  shares: number;
  entryPrice: number;
  entryDate: string;
  currentPrice: number;
  value: number;
  returnPct: number;
  stopLossPrice: number;
  trailingArmed: boolean;
  trailingStopPrice: number | null;
  peakPrice: number;
  logo?: string | null;
}

interface Trade {
  id: number;
  ticker: string;
  action: "BUY" | "SELL";
  shares: number;
  price: number;
  timestamp: string;
  reason: string;
  logo?: string | null;
}

interface PaperData {
  botEnabled: boolean;
  startingCash: number;
  cash: number;
  totalValue: number;
  totalReturnPct: number;
  startedAt: string | null;
  positions: Position[];
  trades: Trade[];
  spyComparison: { returnPct: number } | null;
}

function formatMoney(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export default function PaperTradingPage() {
  const router = useRouter();
  const auth = useAuthStatus();
  const loggedIn = auth ? auth.loggedIn : null; // anyone with an account can run their own bot
  const [data, setData] = useState<PaperData | null>(null);
  const [togglingBot, setTogglingBot] = useState(false);

  const loadData = useCallback(() => {
    fetch("/api/paper")
      .then((r) => (r.ok ? r.json() : null))
      .then(setData)
      .catch(() => setData(null));
  }, []);

  useEffect(() => {
    if (loggedIn === true) loadData();
  }, [loggedIn, loadData]);

  async function toggleBot() {
    if (!data) return;
    setTogglingBot(true);
    try {
      await fetch("/api/paper", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !data.botEnabled }),
      });
      loadData();
    } finally {
      setTogglingBot(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <section className="mx-auto max-w-5xl w-full px-4 sm:px-6 pt-12 pb-16 flex-1">
        <div className="flex items-start justify-between gap-4 flex-wrap mb-2">
          <h1 className="font-serif font-bold text-3xl sm:text-4xl text-[var(--text-primary)]">
            Papperskonto
          </h1>
          <span className="text-[10px] font-mono tracking-widest bg-[rgba(239,68,68,0.12)] text-[var(--red)] border border-[rgba(239,68,68,0.35)] rounded px-2 py-1 self-start">
            SIMULERAT · INGA RIKTIGA PENGAR
          </span>
        </div>
        <p className="text-[var(--text-secondary)] mb-6 max-w-2xl">
          Ditt eget fiktiva {data ? formatMoney(data.startingCash) : "$100,000"}-konto, som du
          själv sätter igång — när boten är på köper den automatiskt i samma stund en aktie når
          BUY eller STRONG BUY, och säljer i samma stund den faller ur, ingen manuell inmatning.
          Två skyddsnät ligger ovanpå signalen: en fast stop-loss på 8% under ingångspriset, och
          en trailing stop som låser in vinst när en position gått upp 15%+ (säljer om den sedan
          backar 10% från sin topp) — båda visas som anledning i handelsloggen nedan.
        </p>

        {loggedIn === false && (
          <div className="rounded-lg border border-[var(--gold-dim)] bg-[rgba(245,165,36,0.06)] px-4 py-3 mb-6 text-sm text-[var(--text-secondary)] max-w-2xl">
            Du behöver ett konto för att köra din egen bot.{" "}
            <Link href="/signup" className="text-[var(--gold)] underline">
              Skapa konto
            </Link>{" "}
            (startar på $100 000) eller{" "}
            <Link href="/login" className="text-[var(--gold)] underline">
              logga in
            </Link>
            .
          </div>
        )}

        {data && (
          <div
            className={`rounded-lg border px-4 py-3 mb-8 max-w-2xl flex items-center justify-between gap-4 flex-wrap ${
              data.botEnabled
                ? "border-[rgba(34,197,94,0.35)] bg-[rgba(34,197,94,0.06)]"
                : "border-[var(--surface-border)] bg-[var(--surface)]"
            }`}
          >
            <div>
              <p className={`text-xs font-mono tracking-widest mb-0.5 ${data.botEnabled ? "text-[var(--green)]" : "text-[var(--text-muted)]"}`}>
                {data.botEnabled ? "BOTEN ÄR PÅ" : "BOTEN ÄR AV"}
              </p>
              <p className="text-sm text-[var(--text-secondary)]">
                {data.botEnabled
                  ? "Handlar automatiskt på nya signaler från och med när du satte igång den."
                  : "Ingen handel sker förrän du sätter igång den."}
              </p>
            </div>
            <button
              onClick={toggleBot}
              disabled={togglingBot}
              className={`px-4 py-2 rounded-md text-sm font-semibold transition disabled:opacity-50 ${
                data.botEnabled
                  ? "border border-[var(--surface-border)] text-[var(--text-secondary)] hover:text-[var(--red)] hover:border-[var(--red)]"
                  : "bg-[var(--green)] text-black hover:brightness-110"
              }`}
            >
              {togglingBot ? "…" : data.botEnabled ? "Stäng av boten" : "Sätt igång boten"}
            </button>
          </div>
        )}

        {/* Only relevant to an account that already existed during that
            window — irrelevant (and confusing) for anyone who signs up
            after the fact, so it's shown only if this account's history
            actually reaches back that far. */}
        {data?.startedAt && new Date(data.startedAt) <= new Date("2026-09-16T23:59:59Z") && (
          <div className="rounded-lg border border-[var(--surface-border)] bg-black/20 px-4 py-3 mb-8 text-xs text-[var(--text-secondary)] max-w-2xl leading-relaxed">
            <p className="font-mono tracking-widest text-[var(--text-muted)] mb-1.5">
              NOTIS, 9–16 SEPTEMBER 2026
            </p>
            <p>
              Under kontots första vecka uppdaterades priserna av misstag var 15:e minut istället
              för en gång per dag som är tänkt, på grund av en bugg i utvecklingsmiljön — det gav
              fler affärer än vad kontot normalt skulle göra, vilket sannolikt gjort resultatet
              sämre än det annars hade blivit. Bortsett från antalet affärer är siffrorna äkta och
              orörda — vi visar dem som de är, inklusive en dålig vecka, istället för att städa bort
              den. Buggen är fixad 16 september.
            </p>
          </div>
        )}

        {/* Same "existed before the fix" scoping as the notice above.
            Only Tim's admin account is old enough to hit this. */}
        {data?.startedAt && new Date(data.startedAt) <= new Date("2026-09-18T23:59:59Z") && (
          <div className="rounded-lg border border-[var(--surface-border)] bg-black/20 px-4 py-3 mb-8 text-xs text-[var(--text-secondary)] max-w-2xl leading-relaxed">
            <p className="font-mono tracking-widest text-[var(--text-muted)] mb-1.5">
              NOTIS, 18 SEPTEMBER 2026 — RÄTTAD 23 SEPTEMBER
            </p>
            <p>
              Två uppdateringskörningar råkade gå samtidigt och köpte ANET dubbelt (en
              låsningsbugg i uppdateringsjobbet, inte i själva signalen) — kontot ägde tillfälligt
              dubbelt så mycket ANET som avsett, utan att motsvarande belopp drogs från kassan.
              Det blåste upp avkastningen med cirka $5 200 (ungefär +4,9 procentenheter) tills det
              upptäcktes. Den extra affären är borttagen och boken stämmer nu exakt mot
              handelsloggen igen; låsningsbuggen är fixad så det inte kan hända igen.
            </p>
          </div>
        )}

        {loggedIn === true && !data && <p className="text-[var(--text-muted)]">Laddar…</p>}

        {data && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
              <div className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] p-4">
                <p className="text-xs font-mono tracking-widest text-[var(--text-muted)] mb-1">TOTALT VÄRDE</p>
                <p className="font-mono text-xl font-bold text-[var(--text-primary)]">
                  {formatMoney(data.totalValue)}
                </p>
              </div>
              <div className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] p-4">
                <p className="text-xs font-mono tracking-widest text-[var(--text-muted)] mb-1">AVKASTNING</p>
                <p
                  className={`font-mono text-xl font-bold ${
                    data.totalReturnPct >= 0 ? "text-[var(--green)]" : "text-[var(--red)]"
                  }`}
                >
                  {formatPct(data.totalReturnPct)}
                </p>
              </div>
              <div className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] p-4">
                <p className="text-xs font-mono tracking-widest text-[var(--text-muted)] mb-1">KONTANTER</p>
                <p className="font-mono text-xl font-bold text-[var(--text-primary)]">
                  {formatMoney(data.cash)}
                </p>
              </div>
              <div className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] p-4">
                <p className="text-xs font-mono tracking-widest text-[var(--text-muted)] mb-1">ÖPPNA POSITIONER</p>
                <p className="font-mono text-xl font-bold text-[var(--text-primary)]">
                  {data.positions.length}
                </p>
              </div>
            </div>

            {data.startedAt && (
              <div className="rounded-lg border border-[rgba(245,165,36,0.3)] bg-[rgba(245,165,36,0.05)] p-5 mb-8 flex items-center justify-between flex-wrap gap-4">
                <div>
                  <p className="text-xs font-mono tracking-widest text-[var(--gold)] mb-1">VS. S&amp;P 500</p>
                  <p className="text-sm text-[var(--text-secondary)]">
                    Samma {formatMoney(data.startingCash)} i SPY sedan den första affären ({timeAgo(data.startedAt)})
                  </p>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className="text-xs font-mono text-[var(--text-muted)]">SIGNALMOTOR</p>
                    <p
                      className={`font-mono text-lg font-bold ${
                        data.totalReturnPct >= 0 ? "text-[var(--green)]" : "text-[var(--red)]"
                      }`}
                    >
                      {formatPct(data.totalReturnPct)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-mono text-[var(--text-muted)]">S&amp;P 500</p>
                    {data.spyComparison ? (
                      <p
                        className={`font-mono text-lg font-bold ${
                          data.spyComparison.returnPct >= 0 ? "text-[var(--green)]" : "text-[var(--red)]"
                        }`}
                      >
                        {formatPct(data.spyComparison.returnPct)}
                      </p>
                    ) : (
                      <p className="font-mono text-lg text-[var(--text-muted)]">—</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {data.positions.length > 0 && (
              <div className="mb-8">
                <p className="text-xs font-mono tracking-widest text-[var(--text-muted)] mb-3">ÖPPNA POSITIONER</p>
                <div className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] overflow-hidden">
                  <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[var(--surface-border)] text-left text-xs font-mono tracking-widest text-[var(--text-muted)]">
                        <th className="px-2.5 sm:px-4 py-3 font-medium">TICKER</th>
                        <th className="px-2.5 sm:px-4 py-3 font-medium text-right">ANTAL</th>
                        <th className="px-2.5 sm:px-4 py-3 font-medium text-right">INGÅNG</th>
                        <th className="px-2.5 sm:px-4 py-3 font-medium text-right">NUVARANDE</th>
                        <th className="px-2.5 sm:px-4 py-3 font-medium text-right">AVKASTNING</th>
                        <th className="px-2.5 sm:px-4 py-3 font-medium text-right">VÄRDE</th>
                        <th className="px-2.5 sm:px-4 py-3 font-medium text-right">SÄLJS VID</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.positions.map((p) => {
                        // Once the trailing stop is armed it's always the tighter,
                        // more protective level (it requires +15% gain first, so
                        // it's mathematically always above the entry-based
                        // stop-loss) — showing both side by side made the static
                        // stop-loss number look stale/wrong once price had moved
                        // well past it. This shows whichever one is actually the
                        // live sell trigger right now, with the other as a tooltip.
                        const usingTrailing = p.trailingArmed && p.trailingStopPrice !== null;
                        const sellsAt = usingTrailing ? p.trailingStopPrice! : p.stopLossPrice;
                        return (
                          <tr
                            key={p.ticker}
                            onClick={() => router.push(`/stock/${p.ticker}`)}
                            className="border-b border-[var(--surface-border)] last:border-0 hover:bg-black/20 cursor-pointer transition-colors"
                          >
                            <td className="px-2.5 sm:px-4 py-3">
                              <Link
                                href={`/stock/${p.ticker}`}
                                onClick={(e) => e.stopPropagation()}
                                className="flex items-center gap-2 font-mono font-semibold text-[var(--gold)] hover:underline"
                              >
                                <CompanyLogo ticker={p.ticker} logoUrl={p.logo} size={20} />
                                {p.ticker}
                              </Link>
                            </td>
                            <td className="px-2.5 sm:px-4 py-3 text-right font-mono text-[var(--text-secondary)] whitespace-nowrap">
                              {p.shares.toFixed(2)}
                            </td>
                            <td className="px-2.5 sm:px-4 py-3 text-right font-mono text-[var(--text-secondary)] whitespace-nowrap">
                              ${formatPrice(p.entryPrice)}
                            </td>
                            <td className="px-2.5 sm:px-4 py-3 text-right font-mono text-[var(--text-primary)] whitespace-nowrap">
                              ${formatPrice(p.currentPrice)}
                            </td>
                            <td
                              className={`px-2.5 sm:px-4 py-3 text-right font-mono whitespace-nowrap ${
                                p.returnPct >= 0 ? "text-[var(--green)]" : "text-[var(--red)]"
                              }`}
                            >
                              {formatPct(p.returnPct)}
                            </td>
                            <td className="px-2.5 sm:px-4 py-3 text-right font-mono text-[var(--text-primary)] whitespace-nowrap">
                              {formatMoney(p.value)}
                            </td>
                            <td
                              className={`px-2.5 sm:px-4 py-3 text-right font-mono whitespace-nowrap ${
                                usingTrailing ? "text-[var(--gold)]" : "text-[var(--red)]"
                              }`}
                              title={
                                usingTrailing
                                  ? `Trailing stop, låses in vid +15%. Golv för fast stop-loss: $${formatPrice(p.stopLossPrice)}`
                                  : "Fast stop-loss, 8% under ingångspriset. Trailing stop tar över vid +15%."
                              }
                            >
                              ${formatPrice(sellsAt)} <span className="text-[10px] opacity-70">{usingTrailing ? "trail" : "stop"}</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  </div>
                </div>
              </div>
            )}

            <div>
              <p className="text-xs font-mono tracking-widest text-[var(--text-muted)] mb-3">HANDELSLOGG</p>
              {data.trades.length === 0 ? (
                <p className="text-[var(--text-muted)] text-sm">
                  Inga affärer ännu — portföljen köper automatiskt nästa gång en spårad aktie
                  når BUY eller STRONG BUY.
                </p>
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
                        <th className="px-2.5 sm:px-4 py-3 font-medium">ANLEDNING</th>
                        <th className="px-2.5 sm:px-4 py-3 font-medium text-right">NÄR</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.trades.map((t) => (
                        <tr
                          key={t.id}
                          onClick={() => router.push(`/stock/${t.ticker}`)}
                          className="border-b border-[var(--surface-border)] last:border-0 hover:bg-black/20 cursor-pointer transition-colors"
                        >
                          <td className="px-2.5 sm:px-4 py-3">
                            <span
                              className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${
                                t.action === "BUY"
                                  ? "bg-[rgba(34,197,94,0.12)] text-[var(--green)]"
                                  : "bg-[rgba(239,68,68,0.12)] text-[var(--red)]"
                              }`}
                            >
                              {t.action}
                            </span>
                          </td>
                          <td className="px-2.5 sm:px-4 py-3">
                            <Link
                              href={`/stock/${t.ticker}`}
                              onClick={(e) => e.stopPropagation()}
                              className="flex items-center gap-2 font-mono font-semibold text-[var(--text-primary)] hover:text-[var(--gold)]"
                            >
                              <CompanyLogo ticker={t.ticker} logoUrl={t.logo} size={20} />
                              {t.ticker}
                            </Link>
                          </td>
                          <td className="px-2.5 sm:px-4 py-3 text-right font-mono text-[var(--text-secondary)] whitespace-nowrap">
                            {t.shares.toFixed(2)}
                          </td>
                          <td className="px-2.5 sm:px-4 py-3 text-right font-mono text-[var(--text-secondary)] whitespace-nowrap">
                            ${formatPrice(t.price)}
                          </td>
                          <td className="px-2.5 sm:px-4 py-3 text-xs font-mono text-[var(--text-muted)] whitespace-nowrap">
                            {t.reason}
                          </td>
                          <td className="px-2.5 sm:px-4 py-3 text-right text-xs font-mono text-[var(--text-muted)] whitespace-nowrap">
                            {timeAgo(t.timestamp)}
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
