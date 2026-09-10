"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { formatValue, initials, InstitutionalManager } from "@/lib/investors";

interface Holding {
  cusip: string;
  issuer: string;
  ticker: string | null;
  value: number;
  shares: number;
  pct: number;
  isNew: boolean;
}

interface ClosedPosition {
  cusip: string;
  issuer: string;
  ticker: string | null;
}

interface ManagerDetail {
  manager: InstitutionalManager;
  filingDate: string | null;
  previousFilingDate: string | null;
  totalValue: number;
  holdings: Holding[];
  closedPositions: ClosedPosition[];
}

export default function InvestorDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [data, setData] = useState<ManagerDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    fetch(`/api/investors/${slug}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.error) setError(json.error);
        else setData(json);
      })
      .catch(() => setError("Could not load this manager's holdings."));
  }, [slug]);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <section className="mx-auto max-w-4xl w-full px-4 sm:px-6 pt-12 pb-16 flex-1">
        <Link
          href="/investors"
          className="text-xs font-mono text-[var(--text-secondary)] hover:text-[var(--gold)] transition"
        >
          ← All investors
        </Link>

        {error && (
          <div className="rounded-lg border border-[rgba(239,68,68,0.35)] bg-[rgba(239,68,68,0.08)] px-2.5 sm:px-4 py-3 text-sm text-[var(--red)] mt-6">
            {error}
          </div>
        )}

        {data && (
          <>
            <div className="flex items-center gap-4 mt-6 mb-2">
              {data.manager.photoUrl && !imgFailed ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={data.manager.photoUrl}
                  alt={data.manager.name}
                  onError={() => setImgFailed(true)}
                  className="h-16 w-16 rounded-full object-cover border border-[var(--surface-border)]"
                />
              ) : (
                <div className="h-16 w-16 rounded-full bg-[rgba(245,165,36,0.12)] border border-[rgba(245,165,36,0.3)] flex items-center justify-center text-[var(--gold)] font-mono font-bold text-lg shrink-0">
                  {initials(data.manager.name)}
                </div>
              )}
              <div>
                <h1 className="font-serif font-bold text-2xl sm:text-3xl text-[var(--text-primary)]">
                  {data.manager.name}
                </h1>
                <p className="text-sm text-[var(--text-secondary)]">{data.manager.fund}</p>
              </div>
            </div>

            {data.filingDate ? (
              <>
                <div className="flex items-baseline gap-6 mb-6 mt-6 flex-wrap">
                  <div>
                    <p className="text-xs font-mono tracking-widest text-[var(--text-muted)]">PORTFOLIO VALUE</p>
                    <p className="font-mono text-2xl font-bold text-[var(--text-primary)]">
                      {formatValue(data.totalValue)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-mono tracking-widest text-[var(--text-muted)]">HOLDINGS</p>
                    <p className="font-mono text-2xl font-bold text-[var(--text-primary)]">
                      {data.holdings.length}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-mono tracking-widest text-[var(--text-muted)]">FILED</p>
                    <p className="font-mono text-2xl font-bold text-[var(--text-primary)]">
                      {new Date(data.filingDate).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <div className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] overflow-hidden mb-8">
                  <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[var(--surface-border)] text-left text-xs font-mono tracking-widest text-[var(--text-muted)]">
                        <th className="px-2.5 sm:px-4 py-3 font-medium">ISSUER</th>
                        <th className="px-2.5 sm:px-4 py-3 font-medium text-right">% PORTFOLIO</th>
                        <th className="px-2.5 sm:px-4 py-3 font-medium text-right">VALUE</th>
                        <th className="px-2.5 sm:px-4 py-3 font-medium text-right">SHARES</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.holdings.map((h) => (
                        <tr
                          key={h.cusip}
                          className="border-b border-[var(--surface-border)] last:border-0 hover:bg-black/20 transition-colors"
                        >
                          <td className="px-2.5 sm:px-4 py-3">
                            <div className="flex items-center gap-2 whitespace-nowrap">
                              {h.ticker ? (
                                <Link
                                  href={`/stock/${h.ticker}`}
                                  className="font-mono font-semibold text-[var(--gold)] hover:underline"
                                >
                                  {h.ticker}
                                </Link>
                              ) : (
                                <span className="font-mono text-[var(--text-muted)]">—</span>
                              )}
                              <span className="text-[var(--text-secondary)] truncate">{h.issuer}</span>
                              {h.isNew && (
                                <span className="text-[10px] font-mono tracking-wider bg-[rgba(245,165,36,0.15)] text-[var(--gold)] border border-[rgba(245,165,36,0.35)] rounded px-1.5 py-0.5 shrink-0">
                                  NEW
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-2.5 sm:px-4 py-3 text-right font-mono text-[var(--text-primary)] whitespace-nowrap">
                            {h.pct.toFixed(1)}%
                          </td>
                          <td className="px-2.5 sm:px-4 py-3 text-right font-mono text-[var(--text-primary)] whitespace-nowrap">
                            {formatValue(h.value)}
                          </td>
                          <td className="px-2.5 sm:px-4 py-3 text-right font-mono text-[var(--text-secondary)] whitespace-nowrap">
                            {h.shares.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>
                </div>

                {data.closedPositions.length > 0 && (
                  <div className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] p-5">
                    <p className="text-xs font-mono tracking-widest text-[var(--text-muted)] mb-3">
                      CLOSED SINCE {data.previousFilingDate && new Date(data.previousFilingDate).toLocaleDateString()}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {data.closedPositions.map((p) => (
                        <span
                          key={p.cusip}
                          className="text-xs font-mono text-[var(--text-secondary)] border border-[var(--surface-border)] rounded px-2 py-1"
                        >
                          {p.ticker ?? p.issuer}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <p className="text-[var(--text-muted)] mt-6">No filing data yet for this manager.</p>
            )}
          </>
        )}
      </section>

      <Footer />
    </div>
  );
}
