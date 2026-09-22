import { db } from "./db";
import {
  STARTING_CASH,
  getCash,
  setCash,
  markStarted,
  getOpenPosition,
  getAutoHolders,
  recordTrade,
  getPortfolioState,
} from "./portfolio";

export { STARTING_CASH };
export type { Trade as PaperTrade, OpenPosition } from "./portfolio";

const ALLOCATION_USD = 5_000; // fixed size per new position, ~5% of starting cash
const MIN_CASH_TO_TRADE = 100;

// A hard stop-loss and a trailing stop on gains, layered on top of the
// signal-based exit. The signal itself is the primary exit — most trades
// still close because the score turns — these two are a safety net for
// what the score misses: a stock cratering before the trend/RSI/volume
// components catch up, or a big gain giving most of itself back before
// the score turns. 8% stop-loss and a 15%-gain-triggered/10%-trail stop
// are standard swing-trading defaults (the same shape as classic
// trend-following stop rules), not values backtested specifically for
// this signal engine.
export const STOP_LOSS_PCT = 8;
export const TRAILING_ARM_PCT = 15;
export const TRAILING_STOP_PCT = 10;

export async function getPeakPrice(userId: number, ticker: string): Promise<number | null> {
  const res = await db.execute({
    sql: "SELECT peak_price FROM paper_position_peaks WHERE user_id = ? AND ticker = ?",
    args: [userId, ticker],
  });
  return (res.rows[0] as { peak_price: number } | undefined)?.peak_price ?? null;
}

async function sellAutoPosition(
  userId: number,
  ticker: string,
  position: { shares: number },
  price: number,
  timestamp: string,
  reason: string
): Promise<void> {
  const proceeds = position.shares * price;
  await recordTrade("auto", userId, ticker, "SELL", position.shares, price, timestamp, reason);
  const cash = await getCash("auto", userId);
  await setCash("auto", userId, cash + proceeds);
  await db.execute({
    sql: "DELETE FROM paper_position_peaks WHERE user_id = ? AND ticker = ?",
    args: [userId, ticker],
  });
}

// Called right after refresh.ts detects a real signal transition, once per
// user who has the bot switched on. Buys a fixed-dollar position the
// moment a ticker newly reaches STRONG BUY (if that user doesn't already
// hold it and their cash allows it); sells the full position the moment a
// held ticker drops off BUY/STRONG BUY. Deliberately mirrors the signal
// engine 1:1 rather than adding its own timing logic on top.
export async function maybeTrade(
  userId: number,
  ticker: string,
  signal: string,
  price: number,
  timestamp: string
): Promise<void> {
  if (!price || price <= 0) return;

  const isBuySignal = signal === "STRONG BUY" || signal === "BUY";
  const position = await getOpenPosition("auto", userId, ticker);

  if (isBuySignal && !position) {
    const cash = await getCash("auto", userId);
    const spend = Math.min(ALLOCATION_USD, cash);
    if (spend < MIN_CASH_TO_TRADE) return;
    const shares = spend / price;
    await recordTrade("auto", userId, ticker, "BUY", shares, price, timestamp, signal);
    await setCash("auto", userId, cash - spend);
    await markStarted("auto", userId, timestamp);
    return;
  }

  if (!isBuySignal && position) {
    await sellAutoPosition(userId, ticker, position, price, timestamp, signal);
  }
}

// Runs on every refresh cycle (not just signal transitions) for every user
// who currently holds an open auto position in this ticker, since a
// stop-loss or trailing stop has to react to price, not to the score
// changing — and it keeps protecting a position even for a user who has
// since switched the bot off, rather than abandoning it unmanaged.
export async function checkRiskExitsForTicker(ticker: string, price: number, timestamp: string): Promise<void> {
  if (!price || price <= 0) return;

  const holders = await getAutoHolders(ticker);
  for (const position of holders) {
    await checkRiskExitForHolder(position.userId, ticker, position, price, timestamp);
  }
}

async function checkRiskExitForHolder(
  userId: number,
  ticker: string,
  position: { shares: number; entryPrice: number },
  price: number,
  timestamp: string
): Promise<void> {
  const pctFromEntry = ((price - position.entryPrice) / position.entryPrice) * 100;
  if (pctFromEntry <= -STOP_LOSS_PCT) {
    await sellAutoPosition(userId, ticker, position, price, timestamp, "STOP LOSS");
    return;
  }

  const storedPeak = await getPeakPrice(userId, ticker);
  const peak = Math.max(storedPeak ?? position.entryPrice, price);

  if (peak !== storedPeak) {
    await db.execute({
      sql: "INSERT INTO paper_position_peaks (user_id, ticker, peak_price, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(user_id, ticker) DO UPDATE SET peak_price=excluded.peak_price, updated_at=excluded.updated_at",
      args: [userId, ticker, peak, timestamp],
    });
  }

  const gainFromEntry = ((peak - position.entryPrice) / position.entryPrice) * 100;
  if (gainFromEntry < TRAILING_ARM_PCT) return;

  const dropFromPeak = ((peak - price) / peak) * 100;
  if (dropFromPeak >= TRAILING_STOP_PCT) {
    await sellAutoPosition(userId, ticker, position, price, timestamp, "TRAILING STOP");
  }
}

export async function getPaperPortfolioState(userId: number) {
  return getPortfolioState("auto", userId);
}
