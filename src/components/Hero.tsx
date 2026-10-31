import Link from "next/link";

export default function Hero({ tickerCount }: { tickerCount: number }) {
  return (
    <section className="relative">
      {/* The "space" backdrop (nebula/stars/horizon glow) now lives on the
          homepage's own top-level wrapper in page.tsx, spanning the whole
          page instead of being clipped to just this section — see
          .space-bg in globals.css. */}
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 pt-14 pb-10">
        <p className="text-xs font-mono font-semibold tracking-[0.2em] text-[var(--accent)] mb-4">
          HELT GRATIS &middot; {tickerCount} US-AKTIER SPÅRADE
        </p>
        <h1 className="font-serif font-bold text-4xl sm:text-6xl leading-[1.05] text-[var(--text-primary)] max-w-3xl">
          Köp- och säljsignaler
          <br />
          för amerikanska aktier.
        </h1>
        <p className="mt-5 max-w-xl text-[var(--text-primary)] text-base sm:text-lg leading-relaxed">
          Varje aktie får en poäng 0&ndash;100 baserat på trend, momentum och volym &mdash;
          och blir en tydlig signal: köp, sälj eller avvakta.
        </p>
        <p className="mt-3 max-w-xl text-[var(--text-secondary)] text-sm leading-relaxed">
          Inget gömt bakom siffran, och ingen bevisad fördel påstås utan bevis &mdash;{" "}
          <Link href="/methodology" className="underline hover:text-[var(--text-primary)]">
            se hela metodiken
          </Link>
          .
        </p>
      </div>
    </section>
  );
}
