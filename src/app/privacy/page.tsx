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

export default function PrivacyPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <section className="mx-auto max-w-3xl w-full px-4 sm:px-6 pt-12 pb-20 flex-1">
        <h1 className="font-serif font-bold text-3xl sm:text-4xl text-[var(--text-primary)] mb-2">
          Integritetspolicy
        </h1>
        <p className="text-[var(--text-secondary)] mb-10">
          Kort och rakt: vad vi samlar in, varför, och vad vi aldrig gör med det. Uppdaterad 24
          september 2026.
        </p>

        <Section title="Vem är ansvarig">
          <p>
            Candor drivs av Tim Sjögren som ett personligt projekt, inte av ett registrerat
            företag. Frågor om dina uppgifter går till{" "}
            <a href="mailto:timsjogrens.jobb@gmail.com" className="underline hover:text-[var(--text-primary)]">
              timsjogrens.jobb@gmail.com
            </a>
            .
          </p>
        </Section>

        <Section title="Vad vi samlar in">
          <p>
            <strong>Om du skapar ett konto med e-post och lösenord:</strong> din e-postadress, och
            ditt lösenord — men aldrig i klartext. Lösenordet hashas (scrypt) innan det sparas; vi
            kan aldrig se eller återställa ditt faktiska lösenord.
          </p>
          <p>
            <strong>Om du loggar in med Google:</strong> vi får din e-postadress från Google för
            att identifiera ditt konto. Inget lösenord skapas eller sparas för ett sånt konto.
          </p>
          <p>
            <strong>Vad du gör på sajten efter inloggning:</strong> din bevakningslista, din
            simulerade papperskonto-historik och dina simulerade egenhandel-affärer — allt
            fiktivt, inga riktiga pengar eller riktiga mäklarkonton är inblandade.
          </p>
          <p>
            <strong>Tekniskt:</strong> en inloggningscookie (håller dig inloggad, går ut när du
            loggar ut) och standardloggar från vår hosting (Vercel) och databas (Turso) — samma
            typ av teknisk drifthistorik alla webbtjänster genererar.
          </p>
        </Section>

        <Section title="Statistik och analys">
          <p>
            Sajten använder <strong>Vercel Analytics</strong> (antal besök, vilka sidor som
            besöks, land och enhetstyp — inte kopplat till ditt konto eller din identitet) och{" "}
            <strong>Microsoft Clarity</strong> (var på sidan folk klickar och rör musen/fingret,
            samt inspelningar av hur en session rör sig genom sajten, för att hitta förvirrande
            eller trasiga delar av gränssnittet). Inga annons-spårare, ingen datainsamling för att
            sälja till tredje part eller för marknadsföring — bara för att förstå hur sajten
            faktiskt används och göra den bättre.
          </p>
          <p>
            Vi säljer eller delar aldrig dina uppgifter med tredje part i övrigt. Din e-post
            används bara för att identifiera ditt eget konto — aldrig för marknadsföring.
          </p>
        </Section>

        <Section title="Hur länge sparas det">
          <p>
            Så länge ditt konto finns. Du kan radera ditt konto och all tillhörande data själv,
            direkt, under{" "}
            <a href="/account" className="underline hover:text-[var(--text-primary)]">
              Mitt konto
            </a>{" "}
            — eller mejla{" "}
            <a href="mailto:timsjogrens.jobb@gmail.com" className="underline hover:text-[var(--text-primary)]">
              timsjogrens.jobb@gmail.com
            </a>{" "}
            om du vill be oss göra det istället.
          </p>
        </Section>

        <Section title="Google-inloggning specifikt">
          <p>
            Om du väljer &ldquo;Fortsätt med Google&rdquo; delar Google bara din verifierade e-postadress med
            oss, inte ditt Google-lösenord eller något annat i ditt Google-konto. Du kan när som
            helst återkalla Candors åtkomst via{" "}
            <a
              href="https://myaccount.google.com/permissions"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-[var(--text-primary)]"
            >
              dina Google-kontoinställningar
            </a>
            .
          </p>
        </Section>
      </section>

      <Footer />
    </div>
  );
}
