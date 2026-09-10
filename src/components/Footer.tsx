import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-[var(--surface-border)] mt-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8 text-xs text-[var(--text-muted)] leading-relaxed space-y-2">
        <p>
          Aura Terminal is not a licensed investment adviser. Signals and scores
          are generated automatically from a rule-based formula, not a proven
          edge &mdash; we have tested five strategies against a broad index and
          none have shown a statistically significant advantage yet (see{" "}
          <Link href="/methodology" className="underline hover:text-[var(--text-secondary)]">
            Methodology
          </Link>
          ). Provided for informational purposes only &mdash; this is not
          financial advice. Always spread risk across multiple holdings and
          never invest more than you can afford to lose.
        </p>
      </div>
    </footer>
  );
}
