export type Signal = "STRONG BUY" | "BUY" | "HOLD" | "SELL" | "STRONG SELL";

export interface ScoreInputs {
  price: number;
  sma50: number | null;
  rsi14: number | null;
  volume: number | null;
  avgVolume: number | null;
}

export interface ScoreBreakdown {
  score: number;
  signal: Signal;
  trendComponent: number | null; // 0-40
  momentumComponent: number | null; // 0-30
  volumeComponent: number | null; // 0-30
  trendPctVsSma: number | null;
  volumeRatio: number | null;
}

export function sma(values: number[], period: number): number | null {
  if (values.length < period) return null;
  const slice = values.slice(values.length - period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

// Classic Wilder RSI over the given period, computed from a chronological
// (oldest -> newest) array of closing prices.
export function rsi(closes: number[], period = 14): number | null {
  if (closes.length < period + 1) return null;
  let gains = 0;
  let losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;

  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export interface ScoreWeights {
  trend: number;
  momentum: number;
  volume: number;
}

export const DEFAULT_WEIGHTS: ScoreWeights = { trend: 40, momentum: 30, volume: 30 };

/**
 * Composite 0-100 score from three real indicators:
 *  - Trend: price vs 50-day SMA (default up to 40 pts)
 *  - Momentum: RSI(14), peaking near 55-65, penalized when overbought/oversold (default up to 30 pts)
 *  - Volume: current volume vs its recent average, confirms conviction (default up to 30 pts)
 * Any missing input drops that component and rescales the rest so the score
 * still reflects only real data (never a fabricated fill-in). Weights are
 * parameterized (defaulting to the live 40/30/30 split) so the same formula
 * can be re-run with different weights for the backtest strategy builder
 * without duplicating this logic.
 */
export function computeScore(inputs: ScoreInputs, weights: ScoreWeights = DEFAULT_WEIGHTS): ScoreBreakdown {
  const components: { weight: number; value: number | null; raw: number | null }[] = [];

  let trendComponent: number | null = null;
  let trendPctVsSma: number | null = null;
  if (inputs.sma50 && inputs.sma50 > 0) {
    trendPctVsSma = ((inputs.price - inputs.sma50) / inputs.sma50) * 100;
    // +/-10% vs SMA50 maps across the full weight range, centered at half.
    trendComponent = clamp(weights.trend / 2 + trendPctVsSma * (weights.trend / 20), 0, weights.trend);
    components.push({ weight: weights.trend, value: trendComponent, raw: trendPctVsSma });
  }

  let momentumComponent: number | null = null;
  if (inputs.rsi14 !== null) {
    const r = inputs.rsi14;
    // Favor RSI in the 50-70 "healthy uptrend" band; penalize <30 (weak) and >80 (overbought).
    let score01: number;
    if (r <= 30) score01 = (r / 30) * 0.3;
    else if (r <= 65) score01 = 0.3 + ((r - 30) / 35) * 0.7;
    else if (r <= 80) score01 = 1 - ((r - 65) / 15) * 0.4;
    else score01 = 0.6 - ((r - 80) / 20) * 0.6;
    momentumComponent = clamp(score01 * weights.momentum, 0, weights.momentum);
    components.push({ weight: weights.momentum, value: momentumComponent, raw: r });
  }

  let volumeComponent: number | null = null;
  let volumeRatio: number | null = null;
  if (inputs.volume && inputs.avgVolume && inputs.avgVolume > 0) {
    volumeRatio = inputs.volume / inputs.avgVolume;
    // 1.0x avg -> mid score, 2x+ avg -> full score, <0.5x -> near zero.
    volumeComponent = clamp(((volumeRatio - 0.5) / 1.5) * weights.volume, 0, weights.volume);
    components.push({ weight: weights.volume, value: volumeComponent, raw: volumeRatio });
  }

  let score: number;
  if (components.length === 0) {
    score = 50;
  } else {
    const totalWeight = components.reduce((a, c) => a + c.weight, 0);
    const sumValue = components.reduce((a, c) => a + (c.value ?? 0), 0);
    score = Math.round((sumValue / totalWeight) * 100);
  }
  score = clamp(score, 0, 100);

  let signal: Signal;
  if (score >= 70) signal = "STRONG BUY";
  else if (score >= 55) signal = "BUY";
  else if (score >= 45) signal = "HOLD";
  else if (score >= 30) signal = "SELL";
  else signal = "STRONG SELL";

  return {
    score,
    signal,
    trendComponent,
    momentumComponent,
    volumeComponent,
    trendPctVsSma,
    volumeRatio,
  };
}
