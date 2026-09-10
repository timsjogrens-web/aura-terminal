const CARDS = [
  {
    number: "01",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M3 9h18M8 4v5M8 14h5M8 17h8" strokeLinecap="round" />
      </svg>
    ),
    title: "Riktiga nyheter, inte bara en siffra",
    description:
      "Varje aktie stäms av mot live-nyheter, filtrerat så bara artiklar som faktiskt nämner bolaget släpps igenom — aldrig generellt marknadsbrus förklätt till bolagsspecifika nyheter.",
  },
  {
    number: "02",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    title: "Varje signal loggas och kontrolleras",
    description:
      "Varje signal loggas i samma stund den ges. Historik-sidan visar sedan exakt vad som hände med priset efteråt — en verklig träffsäkerhet, inte ett påstående du måste ta på tro.",
  },
  {
    number: "03",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 17l6-6 4 4 8-8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M3 21h18" strokeLinecap="round" />
      </svg>
    ),
    title: "Inget gömt bakom poängen",
    description:
      "Varje poäng bryts ner till exakt de faktorer som ligger bakom — trend mot 50-dagars snittet, RSI-momentum och volym mot sitt eget snitt — så du kan se varför en signal gavs, inte bara lita på siffran.",
  },
];

export default function HowItWorks() {
  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6 pb-12">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {CARDS.map((card) => (
          <div
            key={card.number}
            className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] p-6"
          >
            <div className="flex items-start justify-between mb-5">
              <div className="h-10 w-10 rounded-md bg-[rgba(245,165,36,0.1)] border border-[rgba(245,165,36,0.25)] flex items-center justify-center text-[var(--gold)]">
                {card.icon}
              </div>
              <span className="text-xs font-mono text-[var(--text-muted)]">{card.number}</span>
            </div>
            <h3 className="font-sans font-bold text-[var(--text-primary)] mb-2">{card.title}</h3>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
              {card.description}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
