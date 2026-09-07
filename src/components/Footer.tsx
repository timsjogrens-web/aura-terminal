export default function Footer() {
  return (
    <footer className="border-t border-[var(--surface-border)] mt-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8 text-xs text-[var(--text-muted)] leading-relaxed">
        <p>
          Aura Terminal is not a licensed investment adviser. Signals and scores
          are generated automatically from public market data and are provided
          for informational purposes only &mdash; this is not financial advice.
          Always do your own research before making investment decisions.
        </p>
      </div>
    </footer>
  );
}
