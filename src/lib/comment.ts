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
        ? `${pct.toFixed(1)}% above its 50-day average`
        : `${Math.abs(pct).toFixed(1)}% below its 50-day average`
    );
  }

  if (q.rsi14 !== null) {
    if (q.rsi14 >= 70) parts.push(`RSI at ${q.rsi14.toFixed(0)} (overbought)`);
    else if (q.rsi14 <= 30) parts.push(`RSI at ${q.rsi14.toFixed(0)} (oversold)`);
    else parts.push(`RSI at ${q.rsi14.toFixed(0)}`);
  }

  if (q.volume !== null && q.avg_volume !== null && q.avg_volume > 0) {
    const ratio = q.volume / q.avg_volume;
    parts.push(`volume ${ratio.toFixed(1)}x its 20-day average`);
  }

  if (parts.length === 0) {
    return "Not enough historical data yet to break down this score.";
  }

  return parts.join(", ") + ".";
}
