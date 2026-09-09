import { getDailyCandles, YahooError } from "./yahoo";
import { sma, rsi, computeScore, ScoreWeights, Signal } from "./scoring";

const LOOKBACK_RANGE = "2y"; // enough history for SMA50 warmup plus the longest display window
const MIN_DAYS_LATER = 2; // daily-bar analogue of the live 4h minimum gap
const MIN_MOVE_PCT = 5; // same threshold used by the live hit-rate calc

const DISPLAY_DAYS: Record<string, number> = {
  "6M": 126,
  "1Y": 252,
  "2Y": 504,
};

export interface BacktestSignalRow {
  date: string;
  price: number;
  score: number;
  signal: Signal;
  outcome: "hit" | "miss" | null;
}

export interface BacktestResult {
  ticker: string;
  weights: ScoreWeights;
  rows: BacktestSignalRow[];
  hitRate: number | null;
  evaluated: number;
  hits: number;
  buySignalCount: number;
}

export async function runBacktest(
  ticker: string,
  weights: ScoreWeights,
  range: string
): Promise<BacktestResult> {
  const displayDays = DISPLAY_DAYS[range] ?? DISPLAY_DAYS["1Y"];

  let candles;
  try {
    candles = await getDailyCandles(ticker, LOOKBACK_RANGE);
  } catch (e) {
    throw e instanceof YahooError ? e : new YahooError("Failed to fetch historical data.");
  }
  const { closes, volumes, timestamps } = candles;

  if (closes.length < 60) {
    throw new YahooError(`Not enough historical data for ${ticker} to backtest.`);
  }

  const startIdx = Math.max(50, closes.length - displayDays);

  interface DailySignal {
    idx: number;
    price: number;
    score: number;
    signal: Signal;
  }
  const daily: DailySignal[] = [];

  for (let i = 50; i < closes.length; i++) {
    const priorCloses = closes.slice(0, i + 1);
    const sma50 = sma(priorCloses, 50);
    const rsi14 = rsi(priorCloses, 14);
    const volume = volumes[i] ?? null;
    const priorVolumes = volumes.slice(Math.max(0, i - 20), i);
    const avgVolume =
      priorVolumes.length > 0 ? priorVolumes.reduce((a, b) => a + b, 0) / priorVolumes.length : null;

    const breakdown = computeScore({ price: closes[i], sma50, rsi14, volume, avgVolume }, weights);
    daily.push({ idx: i, price: closes[i], score: breakdown.score, signal: breakdown.signal });
  }

  // Only keep transitions (same rule as the live app) so a stock sitting
  // at STRONG BUY for weeks doesn't produce dozens of near-duplicate rows.
  const transitions: DailySignal[] = [];
  let lastSignal: Signal | null = null;
  for (const d of daily) {
    if (d.signal !== lastSignal) {
      transitions.push(d);
      lastSignal = d.signal;
    }
  }

  let hits = 0;
  let evaluated = 0;
  const rows: BacktestSignalRow[] = [];

  for (const t of transitions) {
    if (t.idx < startIdx) continue; // only report within the requested display window

    let outcome: "hit" | "miss" | null = null;
    for (let j = t.idx + MIN_DAYS_LATER; j < closes.length; j++) {
      const pctMove = ((closes[j] - t.price) / t.price) * 100;
      if (Math.abs(pctMove) < MIN_MOVE_PCT) continue;
      if (t.signal.includes("BUY")) outcome = pctMove > 0 ? "hit" : "miss";
      else if (t.signal.includes("SELL")) outcome = pctMove < 0 ? "hit" : "miss";
      break;
    }

    if (outcome) {
      evaluated++;
      if (outcome === "hit") hits++;
    }

    rows.push({
      date: new Date(timestamps[t.idx] * 1000).toISOString().slice(0, 10),
      price: t.price,
      score: t.score,
      signal: t.signal,
      outcome,
    });
  }

  return {
    ticker,
    weights,
    rows,
    hitRate: evaluated > 0 ? Math.round((hits / evaluated) * 100) : null,
    evaluated,
    hits,
    buySignalCount: rows.filter((r) => r.signal.includes("BUY")).length,
  };
}
