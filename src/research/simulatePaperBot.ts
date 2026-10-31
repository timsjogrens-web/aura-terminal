// Simulates the live paper bot's ACTUAL trading mechanics (paperTrading.ts
// + refresh.ts) across the full universe with a shared cash pool, day by
// day, over real historical price data — not the cross-sectional, monthly-
// rebalanced academic factor strategies in strategies.ts, which is a
// different thing entirely (those test the SCORE's ranking ability; this
// tests the live bot's specific trading RULE: buy on STRONG BUY, sell on
// ...what, exactly — that's the question this module exists to answer).
//
// Started after a real account's trade log (Oct 2026) showed a pattern of
// round trips closing in 1-3 days for small losses whenever a holding's
// signal dipped from STRONG BUY/BUY to plain HOLD — a classic whipsaw
// symptom from a threshold rule with no confirmation or minimum hold.
// This lets several candidate EXIT rules be compared against the current
// one under identical conditions (same entry rule, same risk stops, same
// universe, same trading-cost model) instead of guessing.

import { sma, rsi, computeScore, DEFAULT_WEIGHTS, Signal } from "../lib/scoring";
import { oneWayCostFraction } from "../lib/tradingCosts";
import { STARTING_CASH, ALLOCATION_USD, STOP_LOSS_PCT, TRAILING_ARM_PCT, TRAILING_STOP_PCT } from "../lib/paperTrading";
import type { DailyHistory } from "./fetchDailyHistory";

const MIN_CASH_TO_TRADE = 100;

export interface DaySignal {
  close: number; // raw close — the tradeable price
  score: number;
  signal: Signal;
  dollarADV: number | null;
  trendPctVsSma: number | null; // how far above/below its own 50-day average, in % — see runEntryFilterSweep.ts
}

// ticker -> dateString -> that day's signal/price. Built once, reused by
// every variant run so the comparison is apples-to-apples.
export type SignalSeries = Map<string, Map<string, DaySignal>>;

export function buildSignalSeries(history: DailyHistory): { series: SignalSeries; calendar: string[] } {
  const series: SignalSeries = new Map();
  const allDates = new Set<string>();

  for (const [ticker, candles] of Object.entries(history.byTicker)) {
    const { adjCloses, closes, volumes, timestamps } = candles;
    const byDate = new Map<string, DaySignal>();
    for (let i = 50; i < adjCloses.length; i++) {
      const priorCloses = adjCloses.slice(0, i + 1);
      const sma50 = sma(priorCloses, 50);
      const rsi14 = rsi(priorCloses, 14);
      const volume = volumes[i] ?? null;
      const priorVolumes = volumes.slice(Math.max(0, i - 20), i);
      const avgVolume = priorVolumes.length > 0 ? priorVolumes.reduce((a, b) => a + b, 0) / priorVolumes.length : null;
      const breakdown = computeScore({ price: adjCloses[i], sma50, rsi14, volume, avgVolume }, DEFAULT_WEIGHTS);
      const dollarADV = avgVolume !== null ? avgVolume * closes[i] : null;
      const dateStr = new Date(timestamps[i] * 1000).toISOString().slice(0, 10);
      byDate.set(dateStr, {
        close: closes[i],
        score: breakdown.score,
        signal: breakdown.signal,
        dollarADV,
        trendPctVsSma: breakdown.trendPctVsSma,
      });
      allDates.add(dateStr);
    }
    series.set(ticker, byDate);
  }

  const calendar = [...allDates].sort();
  return { series, calendar };
}

export type ExitVariant = "baseline" | "sellFamilyOnly" | "confirm2day" | "minHold5";

export const EXIT_VARIANT_LABELS: Record<ExitVariant, string> = {
  baseline: "Nuvarande: sälj direkt när signalen lämnar BUY-familjen",
  sellFamilyOnly: "Sälj bara på SELL/STRONG SELL (håll kvar genom HOLD)",
  confirm2day: "Kräv 2 dagar i rad under BUY innan sälj",
  minHold5: "Minst 5 dagars innehav innan signalbaserad sälj (riskstoppen gäller ändå direkt)",
};

interface Position {
  ticker: string;
  shares: number;
  entryPrice: number;
  entryDateIdx: number;
  peakPrice: number;
  trailingArmed: boolean;
  daysHeld: number;
  consecutiveBelowBuy: number;
}

interface ClosedTrade {
  ticker: string;
  daysHeld: number;
  pnlPct: number;
  reason: string;
}

export interface SimResult {
  finalValue: number;
  totalReturnPct: number;
  closedTrades: ClosedTrade[];
  totalCostsPaid: number;
  dailyValues: number[]; // cash + mark-to-market, one entry per simulated day — see leverageAnalysis.ts
}

const BUY_FAMILY = new Set<Signal>(["STRONG BUY", "BUY"]);
const SELL_FAMILY = new Set<Signal>(["SELL", "STRONG SELL"]);

function isBuyFamily(s: Signal): boolean {
  return BUY_FAMILY.has(s);
}

function shouldSignalExit(variant: ExitVariant, pos: Position, signal: Signal): boolean {
  if (isBuyFamily(signal)) return false;
  switch (variant) {
    case "baseline":
      return true;
    case "sellFamilyOnly":
      return SELL_FAMILY.has(signal);
    case "confirm2day":
      return pos.consecutiveBelowBuy >= 2;
    case "minHold5":
      return pos.daysHeld >= 5;
  }
}

export interface RiskParams {
  stopLossPct: number;
  trailingArmPct: number;
  trailingStopPct: number;
}

// The live defaults — "standard swing-trading defaults... not values
// backtested specifically for this signal engine" per paperTrading.ts's
// own comment. runRiskParamSweep.ts exists to actually check that.
export const DEFAULT_RISK_PARAMS: RiskParams = {
  stopLossPct: STOP_LOSS_PCT,
  trailingArmPct: TRAILING_ARM_PCT,
  trailingStopPct: TRAILING_STOP_PCT,
};

// Runs one exit variant over calendar[startIdx..endIdxExclusive). Tickers
// are processed in a fixed (alphabetical) order every day so any ordering
// bias from limited cash affects every variant identically.
// Optional extra gate checked on top of "signal === STRONG BUY" before a
// new position is opened — e.g. an overextension cap or a market-regime
// check (see runEntryFilterSweep.ts). Returning true means "allowed to
// enter"; the default (no filter passed) behaves exactly as before.
export type EntryFilter = (ticker: string, date: string, day: DaySignal) => boolean;

export function runSimulation(
  series: SignalSeries,
  calendar: string[],
  startIdx: number,
  endIdxExclusive: number,
  variant: ExitVariant,
  riskParams: RiskParams = DEFAULT_RISK_PARAMS,
  entryFilter?: EntryFilter
): SimResult {
  const tickers = [...series.keys()].sort();
  let cash = STARTING_CASH;
  const positions = new Map<string, Position>();
  const closedTrades: ClosedTrade[] = [];
  let totalCostsPaid = 0;
  const lastKnownPrice = new Map<string, number>();
  const dailyValues: number[] = [];

  for (let dayIdx = startIdx; dayIdx < endIdxExclusive; dayIdx++) {
    const date = calendar[dayIdx];

    // Exits first (frees cash for the same day's entries), fixed ticker
    // order for determinism.
    for (const ticker of tickers) {
      const pos = positions.get(ticker);
      if (!pos) continue;
      const day = series.get(ticker)!.get(date);
      if (!day) continue; // no data this day for this ticker (holiday mismatch, gap, etc.)

      lastKnownPrice.set(ticker, day.close);
      pos.daysHeld++;
      if (!isBuyFamily(day.signal)) pos.consecutiveBelowBuy++;
      else pos.consecutiveBelowBuy = 0;

      let sellReason: string | null = null;

      // Risk stops apply identically under every exit variant — only the
      // signal-based exit condition is what that comparison varies. Here,
      // riskParams is the thing under test instead (see runRiskParamSweep.ts).
      if (day.close <= pos.entryPrice * (1 - riskParams.stopLossPct / 100)) {
        sellReason = "STOP LOSS";
      } else {
        if (!pos.trailingArmed && day.close >= pos.entryPrice * (1 + riskParams.trailingArmPct / 100)) {
          pos.trailingArmed = true;
          pos.peakPrice = day.close;
        }
        if (pos.trailingArmed) {
          pos.peakPrice = Math.max(pos.peakPrice, day.close);
          if (day.close <= pos.peakPrice * (1 - riskParams.trailingStopPct / 100)) {
            sellReason = "TRAILING STOP";
          }
        }
      }
      if (!sellReason && shouldSignalExit(variant, pos, day.signal)) {
        sellReason = "SIGNAL";
      }

      if (sellReason) {
        const cost = oneWayCostFraction(day.dollarADV);
        const execPrice = day.close * (1 - cost);
        const proceeds = pos.shares * execPrice;
        totalCostsPaid += pos.shares * day.close * cost;
        cash += proceeds;
        const pnlPct = ((execPrice - pos.entryPrice) / pos.entryPrice) * 100;
        closedTrades.push({ ticker, daysHeld: pos.daysHeld, pnlPct, reason: sellReason });
        positions.delete(ticker);
      }
    }

    // Entries, same fixed order, using whatever cash remains after exits.
    for (const ticker of tickers) {
      if (positions.has(ticker)) continue;
      const day = series.get(ticker)!.get(date);
      if (!day) continue;
      lastKnownPrice.set(ticker, day.close);
      if (day.signal !== "STRONG BUY") continue;
      if (entryFilter && !entryFilter(ticker, date, day)) continue;
      const spend = Math.min(ALLOCATION_USD, cash);
      if (spend < MIN_CASH_TO_TRADE) continue;
      const cost = oneWayCostFraction(day.dollarADV);
      const execPrice = day.close * (1 + cost);
      const shares = spend / execPrice;
      totalCostsPaid += spend - shares * day.close;
      cash -= spend;
      positions.set(ticker, {
        ticker,
        shares,
        entryPrice: execPrice,
        entryDateIdx: dayIdx,
        peakPrice: execPrice,
        trailingArmed: false,
        daysHeld: 0,
        consecutiveBelowBuy: 0,
      });
    }

    let dayMarkToMarket = 0;
    for (const [ticker, pos] of positions) {
      const price = lastKnownPrice.get(ticker) ?? pos.entryPrice;
      dayMarkToMarket += pos.shares * price;
    }
    dailyValues.push(cash + dayMarkToMarket);
  }

  const finalValue = dailyValues[dailyValues.length - 1] ?? STARTING_CASH;
  return {
    finalValue,
    totalReturnPct: ((finalValue - STARTING_CASH) / STARTING_CASH) * 100,
    closedTrades,
    totalCostsPaid,
    dailyValues,
  };
}
