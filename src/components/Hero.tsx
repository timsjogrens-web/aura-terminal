import Link from "next/link";

export default function Hero({ tickerCount }: { tickerCount: number }) {
  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6 pt-14 pb-10">
      <p className="text-xs font-mono font-semibold tracking-[0.2em] text-[var(--gold)] mb-4">
        SIGNAL ENGINE &middot; {tickerCount} US EQUITIES
      </p>
      <h1 className="font-serif font-bold text-4xl sm:text-6xl leading-[1.05] text-[var(--text-primary)] max-w-3xl">
        Every signal, scored
        <br />
        and checked against reality.
      </h1>
      <p className="mt-5 max-w-xl text-[var(--text-secondary)] text-base sm:text-lg leading-relaxed">
        Every stock is scored 0&ndash;100 from trend, momentum, and volume, then
        paired with the exact indicators that back the call &mdash; nothing
        hidden behind the number. We&rsquo;ve tested this and other strategies
        against a locked hold-out period; none have shown a proven edge yet
        &mdash;{" "}
        <Link href="/methodology" className="underline hover:text-[var(--text-primary)]">
          see the full methodology
        </Link>
        .
      </p>
    </section>
  );
}
