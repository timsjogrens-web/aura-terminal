"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { useAuthStatus } from "@/lib/useAuthStatus";
import CompanyLogo from "@/components/CompanyLogo";
import { timeAgo } from "@/lib/format";
import { CORE_UNIVERSE } from "@/lib/universe";

interface InsiderTrade {
  id: number;
  ticker: string;
  owner_name: string;
  owner_title: string | null;
  transaction_code: string;
  shares: number;
  price: number;
  value: number;
  transaction_date: string;
  filing_date: string;
  logo?: string | null;
}

function formatValue(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

export default function InsidersPage() {
  const [trades, setTrades] = useState<InsiderTrade[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const auth = useAuthStatus();
  const loggedIn = auth ? auth.isAdmin : null; // checking for new filings stays admin-only
  const [filter, setFilter] = useState<"all" | "buys">("buys");

  function load() {
    fetch("/api/insiders")
      .then((r) => r.json())
      .then((json) => {
        if (json.error) setError(json.error);
        else setTrades(json.trades);
      })
      .catch(() => setError("Kunde inte ladda insiderhandel."));
  }

  useEffect(() => {
    load();
  }, []);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await fetch("/api/insiders", { method: "POST" });
      load();
    } finally {
      setRefreshing(false);
    }
  }

  const visible = (trades ?? []).filter((t) => filter === "all" || t.transaction_code === "P");

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <section className="mx-auto max-w-5xl w-full px-4 sm:px-6 pt-12 pb-16 flex-1">
        <div className="flex items-start justify-between gap-4 flex-wrap mb-2">
          <h1 className="font-serif font-bold text-3xl sm:text-4xl text-[var(--text-primary)]">
            Insiderhandel
          </h1>
          {loggedIn === true && (
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="text-xs font-mono border border-[var(--surface-border)] rounded px-3 py-1.5 text-[var(--text-secondary)] hover:text-[var(--accent)] hover:border-[var(--accent-dim)] transition disabled:opacity-50"
            >
              {refreshing ? "Kontrollerar SEC…" : "Kontrollera nya anmälningar"}
            </button>
          )}
        </div>
        <p className="text-[var(--text-secondary)] mb-6 max-w-2xl">
          Köp och sälj på öppna marknaden av direktörer, styrelseledamöter och ägare med 10%+
          innehav i sajtens {CORE_UNIVERSE.length} kärnbolag, hämtat från deras offentliga SEC Form 4-anmälningar.
          Tilldelningar, skatteavdrag och optionsinlösen är exkluderade — bara faktiska,
          frivilliga köp och försäljningar.
        </p>

        <div className="flex items-center gap-1 bg-black/30 rounded-lg p-1 border border-[var(--surface-border)] w-fit mb-6">
          <button
            onClick={() => setFilter("buys")}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${
              filter === "buys"
                ? "bg-[var(--surface-2)] text-[var(--text-primary)]"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            Endast köp
          </button>
          <button
            onClick={() => setFilter("all")}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${
              filter === "all"
                ? "bg-[var(--surface-2)] text-[var(--text-primary)]"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            Alla affärer
          </button>
        </div>

        {error && (
          <div className="rounded-lg border border-[rgba(239,68,68,0.35)] bg-[rgba(239,68,68,0.08)] px-2.5 sm:px-4 py-3 text-sm text-[var(--red)] mb-8">
            {error}
          </div>
        )}

        {trades && trades.length === 0 && (
          <div className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] p-8 text-center text-[var(--text-secondary)] mb-8">
            Inga anmälningar laddade ännu. Klicka på &ldquo;Kontrollera nya anmälningar&rdquo; ovan
            för att hämta senaste Form 4-datan från SEC EDGAR ({CORE_UNIVERSE.length} aktier, tar en minut eller två).
          </div>
        )}

        {trades && trades.length > 0 && (
          <div className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] overflow-hidden">
            <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--surface-border)] text-left text-xs font-mono tracking-widest text-[var(--text-muted)]">
                  <th className="px-1.5 sm:px-4 py-3 font-medium">TICKER</th>
                  <th className="px-1.5 sm:px-4 py-3 font-medium">INSIDER</th>
                  <th className="px-1.5 sm:px-4 py-3 font-medium">ÅTGÄRD</th>
                  <th className="hidden lg:table-cell px-2.5 sm:px-4 py-3 font-medium text-right">ANTAL</th>
                  <th className="hidden lg:table-cell px-2.5 sm:px-4 py-3 font-medium text-right">PRIS</th>
                  <th className="px-1.5 sm:px-4 py-3 font-medium text-right">VÄRDE</th>
                  <th className="hidden xl:table-cell px-2.5 sm:px-4 py-3 font-medium text-right">NÄR</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((t) => (
                  <tr key={t.id} className="border-b border-[var(--surface-border)] last:border-0 hover:bg-black/20 transition-colors">
                    <td className="px-1.5 sm:px-4 py-3">
                      <Link href={`/stock/${t.ticker}`} className="flex items-center gap-2 font-mono font-semibold text-[var(--accent)] hover:underline">
                        <CompanyLogo ticker={t.ticker} logoUrl={t.logo} size={20} />
                        {t.ticker}
                      </Link>
                    </td>
                    <td className="px-1.5 sm:px-4 py-3 max-w-[90px] sm:max-w-[160px] lg:max-w-none">
                      <p className="text-[var(--text-primary)] truncate lg:whitespace-nowrap">{t.owner_name}</p>
                      {t.owner_title && (
                        <p className="text-xs text-[var(--text-muted)] truncate lg:whitespace-nowrap">{t.owner_title}</p>
                      )}
                    </td>
                    <td className="px-1.5 sm:px-4 py-3">
                      <span
                        className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${
                          t.transaction_code === "P"
                            ? "bg-[rgba(34,197,94,0.12)] text-[var(--green)]"
                            : "bg-[rgba(239,68,68,0.12)] text-[var(--red)]"
                        }`}
                      >
                        {t.transaction_code === "P" ? "KÖP" : "SÄLJ"}
                      </span>
                    </td>
                    <td className="hidden lg:table-cell px-2.5 sm:px-4 py-3 text-right font-mono text-[var(--text-secondary)] whitespace-nowrap">
                      {t.shares.toLocaleString()}
                    </td>
                    <td className="hidden lg:table-cell px-2.5 sm:px-4 py-3 text-right font-mono text-[var(--text-secondary)] whitespace-nowrap">
                      ${t.price.toFixed(2)}
                    </td>
                    <td className="px-1.5 sm:px-4 py-3 text-right font-mono text-[var(--text-primary)] whitespace-nowrap">
                      {formatValue(t.value)}
                    </td>
                    <td className="hidden xl:table-cell px-2.5 sm:px-4 py-3 text-right text-xs font-mono text-[var(--text-muted)] whitespace-nowrap">
                      {timeAgo(t.transaction_date)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
            {visible.length === 0 && (
              <p className="text-center text-sm text-[var(--text-muted)] py-8">
                Inga köp på öppna marknaden i den laddade datan ännu.
              </p>
            )}
          </div>
        )}
      </section>

      <Footer />
    </div>
  );
}
