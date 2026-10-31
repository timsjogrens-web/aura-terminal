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
  const borderColor = color ?? "var(--surface-border)";
  return (
    <div
      className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] p-5"
      style={{ borderLeftWidth: 3, borderLeftColor: borderColor }}
    >
      <p className="text-sm font-medium text-[var(--text-secondary)] mb-3">{label}</p>
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
      <Card label="Stiger" value={String(advancing)} color="var(--green)" />
      <Card label="Faller" value={String(declining)} color="var(--red)" />
      <Card label="Snittpoäng" value={avgScore !== null ? String(avgScore) : "—"} />
      <Card label="Köpsignaler" value={String(buySignals)} color="var(--accent)" />
    </section>
  );
}
