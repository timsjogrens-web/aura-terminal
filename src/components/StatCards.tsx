import { Quote } from "@/lib/types";

function Card({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] p-5">
      <p className="text-xs font-mono tracking-widest text-[var(--text-secondary)] mb-3">
        {label}
      </p>
      <p
        className="text-4xl font-mono font-bold"
        style={{ color: color ?? "var(--text-primary)" }}
      >
        {value}
      </p>
    </div>
  );
}

export default function StatCards({ quotes }: { quotes: Quote[] }) {
  const withData = quotes.filter((q) => q.change_pct !== null);
  const advancing = withData.filter((q) => (q.change_pct ?? 0) > 0).length;
  const declining = withData.filter((q) => (q.change_pct ?? 0) < 0).length;
  const withScore = quotes.filter((q) => q.score !== null);
  const avgScore =
    withScore.length > 0
      ? Math.round(withScore.reduce((a, q) => a + (q.score ?? 0), 0) / withScore.length)
      : null;
  const buySignals = quotes.filter(
    (q) => q.signal === "BUY" || q.signal === "STRONG BUY"
  ).length;

  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6 grid grid-cols-2 lg:grid-cols-4 gap-4 pb-10">
      <Card label="STIGER" value={String(advancing)} color="var(--green)" />
      <Card label="FALLER" value={String(declining)} color="var(--red)" />
      <Card label="SNITTPOÄNG" value={avgScore !== null ? String(avgScore) : "—"} />
      <Card label="KÖPSIGNALER" value={String(buySignals)} color="var(--gold)" />
    </section>
  );
}
