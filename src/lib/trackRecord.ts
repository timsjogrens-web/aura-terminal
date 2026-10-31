import { sma, rsi, computeScore, Signal } from "./scoring";
import { oneWayCostFraction } from "./tradingCosts";
import { getDailyCandles, YahooError } from "./yahoo";
import { DEFAULT_UNIVERSE } from "./universe";

// Simulates "what if you had mechanically followed every signal the live
// site ever generated" across the whole tracked universe at once, over
// real historical price data — not a single flattering ticker, the whole
// portfolio, including every drawdown. Mirrors the live paper-trading
// bot's own rules exactly (src/lib/paperTrading.ts): $5,000 per new
// STRONG BUY position (a plain BUY is shown on the site but no longer
// auto-traded — see the entry-threshold sweep this was decided from, in
// paperTrading.ts's maybeTrade comment), sell when a held ticker drops off
// BUY/STRONG BUY entirely, an 8% stop-loss, and a trailing stop that arms
// at +15% and sells on a 10% pullback from peak. Same look-ahead discipline
// as the backtest tool
// (src/lib/backtest.ts): every decision uses data only through that day's
// close, and executes at the NEXT day's open — including stop-loss and
// trailing-stop exits, which in the live bot react within the same
// refresh cycle (a real advantage this simulation does not credit itself
// with, so if anything this understates how fast real risk exits fire).

export const ALLOCATION_USD = 5_000;
// Kept in sync with paperTrading.ts's own copies by hand — see that
// file's comment for why STOP_LOSS_PCT is 10, not the original 8.
export const STOP_LOSS_PCT = 10;
export const TRAILING_ARM_PCT = 15;
export const TRAILING_STOP_PCT = 10;
export const STARTING_CASH = 100_000;
const WARMUP_DAYS = 50; // SMA50 needs this much of a ticker's own history before it's ever traded

export interface TickerSeries {
  ticker: string;
  dates: string[]; // YYYY-MM-DD, ascending, this ticker's own trading days
  adjCloses: number[];
  opens: number[];
  volumes: number[];
}

export interface SimTrade {
  ticker: string;
  action: "BUY" | "SELL";
  shares: number;
  price: number;
  date: string;
  reason: string; // the signal that triggered a BUY/signal-exit, or "STOP LOSS" / "TRAILING STOP"
  returnPct: number | null; // only set for SELL
}

export interface EquityPoint {
  date: string;
  value: number;
}

export interface TrackRecordResult {
  equityCurve: EquityPoint[];
  trades: SimTrade[];
  startDate: string;
  endDate: string;
  finalValue: number;
  totalReturnPct: number;
  maxDrawdownPct: number;
  maxDrawdownPeakDate: string | null;
  maxDrawdownTroughDate: string | null;
  worstTrade: SimTrade | null;
  bestTrade: SimTrade | null;
}

interface OpenPos {
  ticker: string;
  shares: number;
  entryPrice: number;
  entryDate: string;
  peak: number;
}

function dollarAdv(volumes: number[], prices: number[], idx: number): number | null {
  const start = Math.max(0, idx - 20);
  if (start >= idx) return null;
  let sum = 0;
  let n = 0;
  for (let i = start; i < idx; i++) {
    sum += volumes[i] * prices[i];
    n++;
  }
  return n > 0 ? sum / n : null;
}

export function runUniverseTrackRecord(seriesList: TickerSeries[]): TrackRecordResult {
  const dateSet = new Set<string>();
  for (const s of seriesList) for (const d of s.dates) dateSet.add(d);
  const masterDates = [...dateSet].sort();

  const idxByTicker = new Map<string, Map<string, number>>();
  const seriesByTicker = new Map<string, TickerSeries>();
  for (const s of seriesList) {
    idxByTicker.set(s.ticker, new Map(s.dates.map((d, i) => [d, i])));
    seriesByTicker.set(s.ticker, s);
  }

  let cash = STARTING_CASH;
  const positions = new Map<string, OpenPos>();
  const lastSignal = new Map<string, Signal>();
  const trades: SimTrade[] = [];
  const equityCurve: EquityPoint[] = [];

  let pendingBuys: string[] = [];
  let pendingSellReasons = new Map<string, string>();

  let started = false;
  let startDate = "";

  for (const date of masterDates) {
    // 1. Execute yesterday's decisions at TODAY's open.
    for (const [ticker, reason] of pendingSellReasons) {
      const pos = positions.get(ticker);
      const idx = idxByTicker.get(ticker)?.get(date);
      if (!pos || idx === undefined) continue;
      const s = seriesByTicker.get(ticker)!;
      const rawPrice = s.opens[idx];
      const adv = dollarAdv(s.volumes, s.adjCloses, idx);
      const cost = oneWayCostFraction(adv);
      const execPrice = rawPrice * (1 - cost);
      cash += pos.shares * execPrice;
      const returnPct = ((execPrice - pos.entryPrice) / pos.entryPrice) * 100;
      trades.push({ ticker, action: "SELL", shares: pos.shares, price: execPrice, date, reason, returnPct });
      positions.delete(ticker);
    }
    pendingSellReasons = new Map();

    for (const ticker of pendingBuys) {
      if (positions.has(ticker)) continue;
      const idx = idxByTicker.get(ticker)?.get(date);
      if (idx === undefined) continue;
      const spend = Math.min(ALLOCATION_USD, cash);
      if (spend < 100) continue;
      const s = seriesByTicker.get(ticker)!;
      const rawPrice = s.opens[idx];
      const adv = dollarAdv(s.volumes, s.adjCloses, idx);
      const cost = oneWayCostFraction(adv);
      const execPrice = rawPrice * (1 + cost);
      const shares = spend / execPrice;
      cash -= spend;
      positions.set(ticker, { ticker, shares, entryPrice: execPrice, entryDate: date, peak: execPrice });
      trades.push({ ticker, action: "BUY", shares, price: execPrice, date, reason: "signal", returnPct: null });
      if (!started) {
        started = true;
        startDate = date;
      }
    }
    pendingBuys = [];

    // 2. Using TODAY's close, score every ticker and queue tomorrow's orders.
    for (const s of seriesList) {
      const idx = idxByTicker.get(s.ticker)!.get(date);
      if (idx === undefined || idx < WARMUP_DAYS) continue;

      const priorCloses = s.adjCloses.slice(0, idx + 1);
      const sma50 = sma(priorCloses, 50);
      const rsi14 = rsi(priorCloses, 14);
      const volume = s.volumes[idx] ?? null;
      const priorVolumes = s.volumes.slice(Math.max(0, idx - 20), idx);
      const avgVolume =
        priorVolumes.length > 0 ? priorVolumes.reduce((a, b) => a + b, 0) / priorVolumes.length : null;

      const { signal } = computeScore({ price: s.adjCloses[idx], sma50, rsi14, volume, avgVolume });
      const prevSignal = lastSignal.get(s.ticker);
      // Entry requires STRONG BUY specifically; exit fires on an actual
      // SELL/STRONG SELL signal, not just dropping off BUY-or-STRONG-BUY
      // to a neutral HOLD — see paperTrading.ts's maybeTrade for the
      // sweep (src/research/runPaperBotSweep.ts) that changed the exit
      // bar this same way, and why these two bars aren't the same.
      const qualifiesForEntry = signal === "STRONG BUY";
      const wasQualifying = prevSignal === "STRONG BUY";
      const qualifiesForExit = signal === "SELL" || signal === "STRONG SELL";
      const wasExitQualifying = prevSignal === "SELL" || prevSignal === "STRONG SELL";

      if (prevSignal !== undefined && prevSignal !== signal) {
        if (qualifiesForEntry && !wasQualifying && !positions.has(s.ticker)) {
          pendingBuys.push(s.ticker);
        }
        if (qualifiesForExit && !wasExitQualifying && positions.has(s.ticker) && !pendingSellReasons.has(s.ticker)) {
          pendingSellReasons.set(s.ticker, signal);
        }
      }
      lastSignal.set(s.ticker, signal);

      // 3. Risk exits, same day's close, same next-day-open execution as above.
      const pos = positions.get(s.ticker);
      if (pos && !pendingSellReasons.has(s.ticker)) {
        pos.peak = Math.max(pos.peak, s.adjCloses[idx]);
        const pctFromEntry = ((s.adjCloses[idx] - pos.entryPrice) / pos.entryPrice) * 100;
        if (pctFromEntry <= -STOP_LOSS_PCT) {
          pendingSellReasons.set(s.ticker, "STOP LOSS");
        } else {
          const gainFromEntry = ((pos.peak - pos.entryPrice) / pos.entryPrice) * 100;
          if (gainFromEntry >= TRAILING_ARM_PCT) {
            const dropFromPeak = ((pos.peak - s.adjCloses[idx]) / pos.peak) * 100;
            if (dropFromPeak >= TRAILING_STOP_PCT) {
              pendingSellReasons.set(s.ticker, "TRAILING STOP");
            }
          }
        }
      }
    }

    // 4. Mark to market at today's close.
    if (started) {
      let posValue = 0;
      for (const pos of positions.values()) {
        const idx = idxByTicker.get(pos.ticker)!.get(date);
        const s = seriesByTicker.get(pos.ticker)!;
        const price = idx !== undefined ? s.adjCloses[idx] : pos.entryPrice;
        posValue += pos.shares * price;
      }
      equityCurve.push({ date, value: cash + posValue });
    }
  }

  const finalValue = equityCurve.length > 0 ? equityCurve[equityCurve.length - 1].value : STARTING_CASH;
  const totalReturnPct = ((finalValue - STARTING_CASH) / STARTING_CASH) * 100;

  let peakValue = -Infinity;
  let peakDate: string | null = null;
  let maxDrawdownPct = 0;
  let maxDrawdownPeakDate: string | null = null;
  let maxDrawdownTroughDate: string | null = null;
  for (const point of equityCurve) {
    if (point.value > peakValue) {
      peakValue = point.value;
      peakDate = point.date;
    }
    const drawdown = ((point.value - peakValue) / peakValue) * 100;
    if (drawdown < maxDrawdownPct) {
      maxDrawdownPct = drawdown;
      maxDrawdownPeakDate = peakDate;
      maxDrawdownTroughDate = point.date;
    }
  }

  const closedTrades = trades.filter((t) => t.action === "SELL" && t.returnPct !== null);
  const worstTrade = closedTrades.reduce<SimTrade | null>(
    (worst, t) => (!worst || t.returnPct! < worst.returnPct! ? t : worst),
    null
  );
  const bestTrade = closedTrades.reduce<SimTrade | null>(
    (best, t) => (!best || t.returnPct! > best.returnPct! ? t : best),
    null
  );

  return {
    equityCurve,
    trades,
    startDate: startDate || masterDates[0] || "",
    endDate: masterDates[masterDates.length - 1] || "",
    finalValue,
    totalReturnPct,
    maxDrawdownPct,
    maxDrawdownPeakDate,
    maxDrawdownTroughDate,
    worstTrade,
    bestTrade,
  };
}

const FETCH_RANGE = "2y";

function toDateKey(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toISOString().slice(0, 10);
}

export interface UniverseTrackRecordResult extends TrackRecordResult {
  spyEquityCurve: EquityPoint[];
  spyTotalReturnPct: number;
  excludedTickers: string[];
  universeSize: number;
}

// Fetches 2 years of real daily history for every tracked ticker plus SPY,
// then runs the simulation above. This is the only part of this module
// that touches the network — everything else is pure and unit-tested.
export async function computeUniverseTrackRecord(): Promise<UniverseTrackRecordResult> {
  const seriesList: TickerSeries[] = [];
  const excludedTickers: string[] = [];

  // In chunks of a few at a time — ~170 sequential fetches would blow the
  // route's time limit, while one big burst is unkind to Yahoo's free,
  // unauthenticated endpoint. Results are collected in universe order so
  // the simulation stays deterministic.
  const CHUNK = 8;
  for (let i = 0; i < DEFAULT_UNIVERSE.length; i += CHUNK) {
    const chunk = DEFAULT_UNIVERSE.slice(i, i + CHUNK);
    const results = await Promise.all(
      chunk.map(async (entry) => {
        try {
          const candles = await getDailyCandles(entry.ticker, FETCH_RANGE);
          return {
            entry,
            series: {
              ticker: entry.ticker,
              dates: candles.timestamps.map(toDateKey),
              adjCloses: candles.adjCloses,
              opens: candles.opens,
              volumes: candles.volumes,
            } as TickerSeries,
          };
        } catch (e) {
          if (!(e instanceof YahooError)) throw e;
          return { entry, series: null };
        }
      })
    );
    for (const r of results) {
      if (r.series) seriesList.push(r.series);
      else excludedTickers.push(r.entry.ticker);
    }
  }

  const result = runUniverseTrackRecord(seriesList);

  // SPY buy-and-hold over the same window, as the honest comparison —
  // same starting cash, bought once on the simulation's own start date
  // rather than the earliest SPY data available, so it's apples-to-apples.
  let spyEquityCurve: EquityPoint[] = [];
  let spyTotalReturnPct = 0;
  try {
    const spyCandles = await getDailyCandles("SPY", FETCH_RANGE);
    const spyDates = spyCandles.timestamps.map(toDateKey);
    const startIdx = spyDates.findIndex((d) => d >= result.startDate);
    if (startIdx !== -1) {
      const entryPrice = spyCandles.adjCloses[startIdx];
      const shares = STARTING_CASH / entryPrice;
      spyEquityCurve = spyDates
        .slice(startIdx)
        .map((date, i) => ({ date, value: shares * spyCandles.adjCloses[startIdx + i] }));
      const finalSpyValue = spyEquityCurve[spyEquityCurve.length - 1]?.value ?? STARTING_CASH;
      spyTotalReturnPct = ((finalSpyValue - STARTING_CASH) / STARTING_CASH) * 100;
    }
  } catch {
    // SPY comparison is a nice-to-have; the main result still stands without it.
  }

  return {
    ...result,
    spyEquityCurve,
    spyTotalReturnPct,
    excludedTickers,
    universeSize: seriesList.length,
  };
}
