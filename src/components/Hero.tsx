import Link from "next/link";

export default function Hero({ tickerCount }: { tickerCount: number }) {
  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6 pt-14 pb-10">
      <p className="text-xs font-mono font-semibold tracking-[0.2em] text-[var(--gold)] mb-4">
        SIGNALMOTOR &middot; {tickerCount} US-AKTIER
      </p>
      <h1 className="font-serif font-bold text-4xl sm:text-6xl leading-[1.05] text-[var(--text-primary)] max-w-3xl">
        Varje signal, poängsatt
        <br />
        och testad mot verkligheten.
      </h1>
      <p className="mt-5 max-w-xl text-[var(--text-secondary)] text-base sm:text-lg leading-relaxed">
        Varje aktie får en poäng 0&ndash;100 baserat på trend, momentum och volym,
        tillsammans med exakt de indikatorer som ligger bakom beslutet &mdash;
        inget gömt bakom siffran. Vi har testat den här och andra strategier
        mot en låst testperiod; ingen har ännu visat en bevisad fördel
        &mdash;{" "}
        <Link href="/methodology" className="underline hover:text-[var(--text-primary)]">
          se hela metodiken
        </Link>
        .
      </p>
    </section>
  );
}
