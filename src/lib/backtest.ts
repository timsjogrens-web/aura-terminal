import { getDailyCandles, YahooError, DailyCandles } from "./yahoo";
import { sma, rsi, computeScore, ScoreWeights, Signal } from "./scoring";
import { oneWayCostFraction } from "./tradingCosts";

const LOOKBACK_RANGE = "2y"; // enough history for SMA50 warmup plus the longest display window
const MIN_DAYS_LATER = 2; // daily-bar analogue of the live 4h minimum gap
const MIN_MOVE_PCT = 5; // same threshold used by the live hit-rate calc

const DISPLAY_DAYS: Record<string, number> = {
  "6M": 126,
  "1Y": 252,
  "2Y": 504,
};

export interface BacktestSignalRow {
  date: string; // the day the signal fired (data known as of this day's close)
  execDate: string | null; // the day it actually traded — next session's open, null if there wasn't one yet
  signalPrice: number; // adjusted close on the signal day, for reference only — never the traded price
  execPrice: number | null; // next-day open, after estimated trading costs
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
  let candles: DailyCandles;
  try {
    candles = await getDailyCandles(ticker, LOOKBACK_RANGE);
  } catch (e) {
    throw e instanceof YahooError ? e : new YahooError("Failed to fetch historical data.");
  }
  return runBacktestFromCandles(ticker, candles, weights, range);
}

// The actual backtest logic, separated from the network fetch above so
// tests can feed it synthetic candles directly — no live data, no
// flakiness, and it makes the look-ahead test below possible to write at
// all (you can't hand-construct "what Yahoo returns" any other way).
export function runBacktestFromCandles(
  ticker: string,
  candles: DailyCandles,
  weights: ScoreWeights,
  range: string
): BacktestResult {
  const displayDays = DISPLAY_DAYS[range] ?? DISPLAY_DAYS["1Y"];

  // Indicators (SMA/RSI) run on dividend-adjusted close, same as the live
  // signal engine — otherwise a stock's own dividends would look like
  // price weakness and distort the trend/momentum components. Execution
  // uses the real (unadjusted) next-day open, since that's an actual price
  // you could have paid; adjclose is a return-calculation convenience, not
  // a tradeable price.
  const { adjCloses, opens, volumes, timestamps } = candles;

  if (adjCloses.length < 60) {
    throw new YahooError(`Not enough historical data for ${ticker} to backtest.`);
  }

  const startIdx = Math.max(50, adjCloses.length - displayDays);

  interface DailySignal {
    idx: number;
    adjClose: number;
    score: number;
    signal: Signal;
  }
  const daily: DailySignal[] = [];

  for (let i = 50; i < adjCloses.length; i++) {
    const priorCloses = adjCloses.slice(0, i + 1);
    const sma50 = sma(priorCloses, 50);
    const rsi14 = rsi(priorCloses, 14);
    const volume = volumes[i] ?? null;
    const priorVolumes = volumes.slice(Math.max(0, i - 20), i);
    const avgVolume =
      priorVolumes.length > 0 ? priorVolumes.reduce((a, b) => a + b, 0) / priorVolumes.length : null;

    const breakdown = computeScore({ price: adjCloses[i], sma50, rsi14, volume, avgVolume }, weights);
    daily.push({ idx: i, adjClose: adjCloses[i], score: breakdown.score, signal: breakdown.signal });
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

    // The signal is only known once day t.idx's close is in — the
    // earliest anyone could actually act on it is the NEXT session's
    // open, never the same close the score was computed from. If there's
    // no next session yet (signal fired on the most recent bar), it
    // hasn't traded yet at all.
    const execIdx = t.idx + 1;
    const hasExecuted = execIdx < opens.length;
    const rawExecPrice = hasExecuted ? opens[execIdx] : null;

    // HOLD isn't a real trade (never scored for hit/miss either, below) —
    // only BUY/SELL-family signals actually cost anything or execute.
    const isTradeable = t.signal !== "HOLD";

    let execPrice: number | null = null;
    if (rawExecPrice !== null && isTradeable) {
      const dollarADV =
        volumes.slice(Math.max(0, t.idx - 20), t.idx).reduce((a, b) => a + b, 0) / 20 || null;
      const adv = dollarADV !== null ? dollarADV * t.adjClose : null;
      const cost = oneWayCostFraction(adv);
      // Buying costs more than the quoted price, selling nets less than it.
      execPrice = t.signal.includes("BUY") ? rawExecPrice * (1 + cost) : rawExecPrice * (1 - cost);
    }

    let outcome: "hit" | "miss" | null = null;
    if (execPrice !== null) {
      for (let j = execIdx + MIN_DAYS_LATER; j < adjCloses.length; j++) {
        const pctMove = ((adjCloses[j] - execPrice) / execPrice) * 100;
        if (Math.abs(pctMove) < MIN_MOVE_PCT) continue;
        if (t.signal.includes("BUY")) outcome = pctMove > 0 ? "hit" : "miss";
        else if (t.signal.includes("SELL")) outcome = pctMove < 0 ? "hit" : "miss";
        break;
      }
    }

    if (outcome) {
      evaluated++;
      if (outcome === "hit") hits++;
    }

    rows.push({
      date: new Date(timestamps[t.idx] * 1000).toISOString().slice(0, 10),
      execDate: hasExecuted ? new Date(timestamps[execIdx] * 1000).toISOString().slice(0, 10) : null,
      signalPrice: t.adjClose,
      execPrice,
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
