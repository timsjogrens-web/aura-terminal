"use client";

import Header from "@/components/Header";
import Footer from "@/components/Footer";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="font-serif font-bold text-xl sm:text-2xl text-[var(--text-primary)] mb-3">
        {title}
      </h2>
      <div className="text-sm sm:text-base text-[var(--text-secondary)] leading-relaxed space-y-3">
        {children}
      </div>
    </section>
  );
}

export default function TermsPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <section className="mx-auto max-w-3xl w-full px-4 sm:px-6 pt-12 pb-20 flex-1">
        <h1 className="font-serif font-bold text-3xl sm:text-4xl text-[var(--text-primary)] mb-2">
          Användarvillkor
        </h1>
        <p className="text-[var(--text-secondary)] mb-10">
          Kort och rakt. Uppdaterad 22 september 2026.
        </p>

        <Section title="Vad Candor är">
          <p>
            Candor är ett personligt, icke-kommersiellt projekt av Tim Sjögren — inte ett
            registrerat finansföretag och inte en licensierad investeringsrådgivare. Signaler,
            poäng och allt innehåll tillhandahålls endast i informationssyfte och är inte
            finansiell rådgivning. Se{" "}
            <a href="/methodology" className="underline hover:text-[var(--text-primary)]">
              Metodik &amp; ärlighet
            </a>{" "}
            för exakt vad som är testat och inte.
          </p>
        </Section>

        <Section title="Inga riktiga pengar">
          <p>
            Papperskontot, den automatiska boten och egenhandel-funktionen är simulerade —
            fiktiva pengar, ingen koppling till någon riktig mäklare eller bank. Ingenting du gör
            på sajten är en riktig affär.
          </p>
        </Section>

        <Section title="Ditt konto">
          <p>
            Du ansvarar för att uppgifterna du anger vid registrering är dina egna, och för att
            hålla ditt lösenord hemligt. Vi kan stänga av eller radera konton som missbrukar
            sajten (t.ex. massregistrering, försök att kringgå tekniska skydd).
          </p>
        </Section>

        <Section title="Inga garantier">
          <p>
            Sajten tillhandahålls i befintligt skick, utan garantier om drifttid, riktighet eller
            att den passar ett specifikt syfte. Data kommer från tredjepartskällor (Finnhub,
            Yahoo Finance, SEC EDGAR) och kan innehålla fel eller förseningar.
          </p>
        </Section>

        <Section title="Ändringar">
          <p>
            Villkoren kan uppdateras. Väsentliga ändringar visas på sajten. Fortsatt användning
            efter en ändring räknas som godkännande av de nya villkoren.
          </p>
        </Section>

        <Section title="Kontakt">
          <p>
            Frågor:{" "}
            <a href="mailto:timsjogrens.jobb@gmail.com" className="underline hover:text-[var(--text-primary)]">
              timsjogrens.jobb@gmail.com
            </a>
            . Se även{" "}
            <a href="/privacy" className="underline hover:text-[var(--text-primary)]">
              Integritetspolicy
            </a>
            .
          </p>
        </Section>
      </section>

      <Footer />
    </div>
  );
}
