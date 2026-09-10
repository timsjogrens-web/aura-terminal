// Statistics for evaluating a monthly return series. Kept dependency-free
// and separate from the live app — this is research tooling, not something
// that runs in production.

export function monthlyReturnsFromPrices(prices: number[]): number[] {
  const rets: number[] = [];
  for (let i = 1; i < prices.length; i++) rets.push(prices[i] / prices[i - 1] - 1);
  return rets;
}

export function cagr(prices: number[], monthsPerYear = 12): number {
  const totalReturn = prices[prices.length - 1] / prices[0];
  const years = (prices.length - 1) / monthsPerYear;
  if (years <= 0) return 0;
  return Math.pow(totalReturn, 1 / years) - 1;
}

export function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

export function sampleStd(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  const variance = xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1);
  return Math.sqrt(variance);
}

export function annualizedVol(monthlyRets: number[]): number {
  return sampleStd(monthlyRets) * Math.sqrt(12);
}

// Annualized Sharpe ratio from monthly returns.
export function sharpeRatio(monthlyRets: number[], riskFreeAnnual = 0): number {
  const excessMonthly = mean(monthlyRets) - riskFreeAnnual / 12;
  const vol = annualizedVol(monthlyRets);
  if (vol === 0) return 0;
  return (excessMonthly * 12) / vol;
}

// Max peak-to-trough decline in a price/equity series, as a negative fraction.
export function maxDrawdown(prices: number[]): number {
  let peak = prices[0];
  let worst = 0;
  for (const p of prices) {
    peak = Math.max(peak, p);
    worst = Math.min(worst, p / peak - 1);
  }
  return worst;
}

export interface AlphaBeta {
  alphaAnnual: number;
  beta: number;
  tStatAlpha: number;
}

// OLS regression of strategy monthly returns on benchmark monthly returns:
// stratRet = alpha + beta * benchRet + residual.
export function alphaBeta(stratRets: number[], benchRets: number[]): AlphaBeta {
  const n = stratRets.length;
  if (n !== benchRets.length || n < 3) return { alphaAnnual: 0, beta: 0, tStatAlpha: 0 };

  const mx = mean(benchRets);
  const my = mean(stratRets);
  let sxy = 0;
  let sxx = 0;
  for (let i = 0; i < n; i++) {
    sxy += (benchRets[i] - mx) * (stratRets[i] - my);
    sxx += (benchRets[i] - mx) ** 2;
  }
  const beta = sxx === 0 ? 0 : sxy / sxx;
  const alphaMonthly = my - beta * mx;

  let sse = 0;
  for (let i = 0; i < n; i++) {
    const predicted = alphaMonthly + beta * benchRets[i];
    sse += (stratRets[i] - predicted) ** 2;
  }
  const residualVar = n > 2 ? sse / (n - 2) : 0;
  const seAlpha = sxx === 0 ? 0 : Math.sqrt(residualVar * (1 / n + mx ** 2 / sxx));
  const tStatAlpha = seAlpha === 0 ? 0 : alphaMonthly / seAlpha;

  return { alphaAnnual: alphaMonthly * 12, beta, tStatAlpha };
}

// Standard normal CDF (Abramowitz & Stegun 7.1.26 approximation, |error| < 7.5e-8).
export function normalCdf(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989423 * Math.exp((-x * x) / 2);
  let p =
    d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  if (x > 0) p = 1 - p;
  return p;
}

// Inverse standard normal CDF (Acklam's algorithm).
export function normalInvCdf(p: number): number {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.383577518672690e2, -3.066479806614716e1, 2.506628277459239];
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];
  const pLow = 0.02425;
  const pHigh = 1 - pLow;
  let q: number, r: number;
  if (p < pLow) {
    q = Math.sqrt(-2 * Math.log(p));
    return (
      (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
    );
  } else if (p <= pHigh) {
    q = p - 0.5;
    r = q * q;
    return (
      ((((( a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
      (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
    );
  } else {
    q = Math.sqrt(-2 * Math.log(1 - p));
    return (
      -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
    );
  }
}

// Deflated Sharpe Ratio (Bailey & Lopez de Prado, 2014) — approximate.
// Question it answers: given we tried `numTrials` strategy variants and
// picked the best one, what's the probability its true Sharpe ratio is
// actually above zero — as opposed to it just being the luckiest of N noisy
// draws? A DSR well below ~0.95 means: don't trust this Sharpe ratio, it's
// plausibly explained by multiple testing alone.
//
// This is the standard closed-form approximation from the paper, using the
// sample's own skew/kurtosis to correct the Sharpe ratio's standard error,
// and the expected maximum of `numTrials` standard-normal draws as the
// "null" benchmark the observed Sharpe has to beat. It is NOT a full
// simulation-based DSR (which would require the joint distribution of all
// trials' returns) — treat it as a rigorous approximation, not a proof.
export function deflatedSharpeRatio(monthlyRets: number[], numTrials: number): number {
  const T = monthlyRets.length;
  if (T < 3) return 0;
  const srMonthly = mean(monthlyRets) / (sampleStd(monthlyRets) || 1e-9);

  const m = mean(monthlyRets);
  const std = sampleStd(monthlyRets) || 1e-9;
  const skew = monthlyRets.reduce((a, b) => a + ((b - m) / std) ** 3, 0) / T;
  const kurt = monthlyRets.reduce((a, b) => a + ((b - m) / std) ** 4, 0) / T; // raw, not excess

  const srVariance =
    (1 - skew * srMonthly + ((kurt - 1) / 4) * srMonthly * srMonthly) / (T - 1);
  const srStd = Math.sqrt(Math.max(srVariance, 1e-9));

  const gamma = 0.5772156649; // Euler-Mascheroni constant
  const expectedMaxSr0 =
    numTrials <= 1
      ? 0
      : srStd *
        ((1 - gamma) * normalInvCdf(1 - 1 / numTrials) +
          gamma * normalInvCdf(1 - 1 / (numTrials * Math.E)));

  const z = (srMonthly - expectedMaxSr0) / srStd;
  return normalCdf(z);
}
