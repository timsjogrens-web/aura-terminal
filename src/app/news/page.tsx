"use client";

import { useEffect, useState } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { MarketNewsItem } from "@/app/api/market-news/route";

function timeAgo(unixSeconds: number): string {
  const diffMs = Date.now() - unixSeconds * 1000;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just nu";
  if (mins < 60) return `${mins}m sedan`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h sedan`;
  return `${Math.floor(hours / 24)}d sedan`;
}

export default function NewsPage() {
  const [news, setNews] = useState<MarketNewsItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/market-news")
      .then((r) => r.json())
      .then((json) => {
        if (json.error) setError(json.error);
        else setNews(json.news);
      })
      .catch(() => setError("Kunde inte ladda marknadsnyheter."));
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <section className="mx-auto max-w-3xl w-full px-4 sm:px-6 pt-12 pb-16 flex-1">
        <h1 className="font-serif font-bold text-3xl sm:text-4xl text-[var(--text-primary)] mb-2">
          Marknadsnyheter
        </h1>
        <p className="text-[var(--text-secondary)] mb-8">
          Aktuella finans- och näringslivsrubriker, hämtade live.
        </p>

        {error && (
          <div className="rounded-lg border border-[rgba(239,68,68,0.35)] bg-[rgba(239,68,68,0.08)] px-4 py-3 text-sm text-[var(--red)]">
            {error}
          </div>
        )}

        {!error && !news && (
          <div className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] p-8 text-center text-[var(--text-secondary)]">
            Laddar…
          </div>
        )}

        {news && news.length === 0 && (
          <div className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] p-8 text-center text-[var(--text-secondary)]">
            Inga nyheter tillgängliga just nu.
          </div>
        )}

        {news && news.length > 0 && (
          <div className="flex flex-col gap-3">
            {news.map((item, i) => (
              <a
                key={i}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] p-4 flex gap-4 hover:border-[var(--accent-dim)] transition-colors"
              >
                {item.image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.image}
                    alt=""
                    className="w-24 h-24 object-cover rounded-md shrink-0 hidden sm:block bg-black/30"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                )}
                <div className="min-w-0">
                  <p className="text-[var(--text-primary)] font-medium leading-snug mb-1.5">
                    {item.headline}
                  </p>
                  <p className="text-xs font-mono text-[var(--text-muted)]">
                    {item.source} &middot; {timeAgo(item.datetime)}
                  </p>
                </div>
              </a>
            ))}
          </div>
        )}
      </section>

      <Footer />
    </div>
  );
}
