import Link from "next/link";
import { Quote } from "@/lib/types";
import { formatPrice } from "@/lib/format";
import Sparkline from "./Sparkline";
import SignalBadge from "./SignalBadge";
import WatchlistButton from "./WatchlistButton";
import { buildComment } from "@/lib/comment";
import NewsList from "./NewsList";
import CompanyLogo from "./CompanyLogo";

export default function StockCard({ q }: { q: Quote }) {
  return (
    <div className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] p-5 flex flex-col gap-4 hover:border-[var(--accent-dim)] transition-colors">
      <Link href={`/stock/${q.ticker}`} className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <CompanyLogo ticker={q.ticker} logoUrl={q.logo} size={32} />
            <div>
              <p className="text-xl font-sans font-bold text-[var(--text-primary)]">{q.ticker}</p>
              <p className="text-sm text-[var(--text-secondary)]">{q.company_name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <WatchlistButton ticker={q.ticker} companyName={q.company_name ?? undefined} sector={q.sector ?? undefined} />
            <SignalBadge signal={q.signal} score={q.score} />
          </div>
        </div>

        <div className="flex items-end justify-between gap-3">
          <p className="text-3xl font-mono font-semibold text-[var(--text-primary)] whitespace-nowrap">
            {q.price !== null ? `$${formatPrice(q.price)}` : "—"}
          </p>
          <Sparkline data={q.sparkline} />
        </div>

        <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
          {q.error ? <span className="text-[var(--red)]">{q.error}</span> : buildComment(q)}
        </p>

        {q.next_earnings && (
          <p className="text-xs font-mono text-[var(--text-muted)] border-t border-[var(--surface-border)] pt-3">
            Nästa rapport: <span className="text-[var(--text-secondary)]">{q.next_earnings}</span>
          </p>
        )}
      </Link>

      <NewsList news={q.news} />
    </div>
  );
}
