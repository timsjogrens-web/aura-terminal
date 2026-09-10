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

export default function MethodologyPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <section className="mx-auto max-w-3xl w-full px-4 sm:px-6 pt-12 pb-20 flex-1">
        <h1 className="font-serif font-bold text-3xl sm:text-4xl text-[var(--text-primary)] mb-2">
          Metodik &amp; ärlighet
        </h1>
        <p className="text-[var(--text-secondary)] mb-10">
          Den här sidan beskriver exakt hur Aura Terminal fungerar, vad vi faktiskt testat, och vad
          vi ännu inte kan bevisa. Uppdaterad löpande i takt med att fler strategier testas.
        </p>

        <div className="rounded-lg border border-[var(--gold-dim)] bg-[rgba(245,165,36,0.06)] p-5 mb-10">
          <p className="font-mono text-xs tracking-widest text-[var(--gold)] mb-2">
            NULÄGE, I KORTHET
          </p>
          <p className="text-sm text-[var(--text-primary)] leading-relaxed">
            Vi har hittills testat fem olika köpstrategier mot en rättvis, bred aktielista
            (S&amp;P 500) med en låst testperiod som aldrig användes för att justera strategierna.
            <strong> Ingen av dem har visat en statistiskt säkerställd fördel mot index</strong> i
            den låsta testperioden. Det gäller även de poäng och signaler du ser på sajten idag —
            de bygger på en formel som ännu inte bevisats slå index. Vi säger det rakt ut istället
            för att antyda något annat.
          </p>
        </div>

        <Section title="Vad sajten faktiskt gör">
          <p>
            Aura Terminal räknar ut en poäng 0–100 för varje spårad aktie, baserat på tre saker:
            hur priset ligger jämfört med sitt 50-dagars glidande medelvärde (trend), RSI-momentum,
            och handelsvolym jämfört med sitt eget snitt. Poängen översätts till en signal:
            STRONG BUY, BUY, HOLD, SELL eller STRONG SELL.
          </p>
          <p>
            Det här är en <strong>regelbaserad formel</strong>, inte en tränad AI-modell och inte
            en professionell analytikers bedömning. Vikterna (40/30/30 mellan trend, momentum och
            volym) är satta utifrån vad som är vanligt i teknisk analys-litteratur — de är inte
            optimerade mot historisk data, eftersom det hade varit exakt den typen av
            överanpassning (overfitting) vi aktivt försöker undvika.
          </p>
        </Section>

        <Section title="Hur vi testar om en strategi faktiskt fungerar">
          <p>
            Allt seriöst test görs mot en <strong>låst testperiod</strong> — de senaste 24
            månaderna av data, som aldrig tittas på eller används för att justera en strategi innan
            den är helt fastställd. Bara på det sättet kan ett resultat räknas som ett genuint
            test, inte en efterhandskonstruktion.
          </p>
          <p>
            Vi mäter risk-justerad avkastning (Sharpe-kvot), hur stor nedgång strategin haft som
            värst (max drawdown), och om överavkastningen är statistiskt säkerställd (t-värde) —
            inte bara total avkastning, som lätt förväxlar tur och skicklighet med hög risk.
          </p>
          <p>
            Vi använder också en s.k. Deflated Sharpe Ratio, som straffar ett resultat i
            förhållande till hur många olika strategivarianter som testats — testar man fem saker
            är sannolikheten större att minst en råkar se bra ut av ren slump, så måttet kräver
            starkare bevis ju fler varianter som prövats.
          </p>
        </Section>

        <Section title="Vad vi testat och vad vi hittat">
          <p>
            Fem prisbaserade strategier testade mot S&amp;P 500 (2019–2026, låst testperiod de
            senaste 24 månaderna): momentum, låg volatilitet, en kombination av de två, kortsiktig
            reversering, samt närhet till 52-veckors högstanivå.
          </p>
          <p>
            <strong>Resultat:</strong> momentum hade högst rå avkastning, men mest för att den tog
            betydligt mer marknadsrisk — inte för att den träffade rätt oftare. Ingen av de fem
            strategierna hade en statistiskt säkerställd överavkastning i den låsta testperioden.
          </p>
          <p>
            Vi undersökte även att testa vinstöverraskningar (PEAD) och bolagskvalitet/värdering,
            men uteslöt dem: vår gratis datakälla ger bara fyra kvartals historik per bolag för
            vinstöverraskningar (för lite för ett riktigt test), och nyckeltal som P/E och ROE
            finns bara som dagens siffra — att använda dagens siffra för ett beslut för flera år
            sedan hade varit precis den typen av framtidsdataläckage (look-ahead bias) vi aktivt
            testar bort på andra ställen på sajten.
          </p>
        </Section>

        <Section title="Kända begränsningar">
          <p>
            <strong>Survivorship bias:</strong> aktielistorna vi testar mot (både sajtens
            handplockade 40 bolag och S&amp;P 500-listan) är dagens bolag — inte en historiskt
            korrekt lista som även innehåller bolag som gått i konkurs eller plockats bort sedan
            dess. Det gör att resultat sannolikt ser något bättre ut än verkligheten skulle ge. En
            fullständig fix kräver betaldata (t.ex. Sharadar eller Norgate), vilket vi medvetet
            valt bort för att hålla sajten gratis.
          </p>
          <p>
            <strong>Handelskostnader:</strong> forskningstesterna ovan inkluderar ännu inte
            handelskostnader (courtage, växlingsavgift, spread) — det görs separat i
            Backtest-verktyget, men inte i den bredare strategiforskningen än. Riktiga kostnader
            skulle sänka alla siffror ovan något, särskilt för strategier som handlar ofta.
          </p>
          <p>
            <strong>Ingen kvalitet/värde-faktor:</strong> se ovan — kräver betaldata för att göras
            utan att fuska med framtidsinformation.
          </p>
        </Section>

        <Section title="Vad det betyder för dig">
          <p>
            Signalerna och poängen på sajten är ett sätt att strukturerat granska ett stort antal
            aktier snabbt — inte ett bevisat facit för vad som kommer stiga. Historiskt har det
            varit mycket svårt att systematiskt slå ett brett index efter kostnader, även för
            professionella förvaltare. Räkna med att så förblir fallet tills vi kan visa något
            annat med riktiga siffror.
          </p>
          <p>
            Se alltid till att sprida risk över flera bolag och branscher, och investera aldrig mer
            än du har råd att förlora. Riskkalkylatorn hjälper dig räkna på hur stor en enskild
            position rimligen bör vara.
          </p>
        </Section>

        <Section title="Vem ligger bakom sajten">
          <p>
            Aura Terminal drivs som ett personligt projekt, inte av ett registrerat
            finansföretag. Sajten är inte en licensierad investeringsrådgivare och lämnar ingen
            personlig rådgivning. Allt innehåll är automatiskt genererat från offentlig marknadsdata
            och tillhandahålls i informationssyfte.
          </p>
        </Section>
      </section>

      <Footer />
    </div>
  );
}
