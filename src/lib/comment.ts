import { Quote } from "./types";

// Builds a one-line explanation strictly from the real indicators on the
// quote — never a canned phrase, so it can't say something the numbers
// don't support.
export function buildComment(q: Quote): string {
  const parts: string[] = [];

  if (q.sma50 !== null && q.price !== null) {
    const pct = ((q.price - q.sma50) / q.sma50) * 100;
    parts.push(
      pct >= 0
        ? `${pct.toFixed(1)}% över sitt 50-dagarssnitt`
        : `${Math.abs(pct).toFixed(1)}% under sitt 50-dagarssnitt`
    );
  }

  if (q.rsi14 !== null) {
    if (q.rsi14 >= 70) parts.push(`RSI på ${q.rsi14.toFixed(0)} (överköpt)`);
    else if (q.rsi14 <= 30) parts.push(`RSI på ${q.rsi14.toFixed(0)} (översåld)`);
    else parts.push(`RSI på ${q.rsi14.toFixed(0)}`);
  }

  if (q.volume !== null && q.avg_volume !== null && q.avg_volume > 0) {
    const ratio = q.volume / q.avg_volume;
    parts.push(`volym ${ratio.toFixed(1)}x sitt 20-dagarssnitt`);
  }

  if (parts.length === 0) {
    return "Inte tillräckligt med historisk data ännu för att bryta ner denna poäng.";
  }

  return parts.join(", ") + ".";
}
