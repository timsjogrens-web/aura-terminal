import { NewsItem } from "@/lib/types";

function timeAgoShort(unixSeconds: number): string {
  const diffMs = Date.now() - unixSeconds * 1000;
  const hours = Math.floor(diffMs / 3600000);
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function NewsList({ news }: { news: NewsItem[] }) {
  if (!news || news.length === 0) return null;

  return (
    <div className="border-t border-[var(--surface-border)] pt-3 flex flex-col gap-2">
      <p className="text-xs font-mono tracking-widest text-[var(--text-secondary)]">
        RECENT NEWS
      </p>
      {news.map((n, i) => (
        <a
          key={i}
          href={n.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-[var(--text-secondary)] hover:text-[var(--gold)] transition-colors leading-snug flex gap-2"
        >
          <span className="shrink-0 text-[var(--text-muted)] font-mono text-xs mt-0.5">
            {timeAgoShort(n.datetime)}
          </span>
          <span className="line-clamp-1">{n.headline}</span>
        </a>
      ))}
    </div>
  );
}
