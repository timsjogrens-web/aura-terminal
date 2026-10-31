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

export const ALLOCATION_USD = 5_000; // fixed size per new position, ~5% of starting cash
const MIN_CASH_TO_TRADE = 100;

// A hard stop-loss and a trailing stop on gains, layered on top of the
// signal-based exit. The signal itself is the primary exit — most trades
// still close because the score turns — these two are a safety net for
// what the score misses: a stock cratering before the trend/RSI/volume
// components catch up, or a big gain giving most of itself back before
// the score turns. These started as standard swing-trading defaults (8%
// stop-loss, 15%-gain-triggered/10%-trail), not values backtested
// specifically for this signal engine.
//
// Stop-loss WAS checked (src/research/runRiskParamSweep.ts, one parameter
// varied at a time, others held at today's defaults, same half-split
// robustness check as the entry bar and exit rule): 5% lost money in BOTH
// halves (too tight — stopped out of normal noise before a real recovery);
// 8% (old default) and 12% were both positive in both halves but uneven
// between them; 10% was also positive in both halves AND the most
// consistent of the four (+1.6%/+3.3% vs 8%'s +8.5%/+1.4%), with a higher
// full-period return, a better win rate, and fewer whipsaw-length trades.
// Trailing-arm and trailing-stop were swept the same way and did NOT show
// a value that beat today's defaults on both consistency and return — no
// change there; if anything it's a point in favor of those two numbers,
// not just an untested guess. Same caveats as every other sweep in this
// file's history: 2 years of Yahoo data, not a true untouched holdout.
export const STOP_LOSS_PCT = 10;
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
// moment a ticker newly reaches STRONG BUY specifically — NOT plain BUY —
// if that user doesn't already hold it and their cash allows it; sells the
// full position the moment a held ticker's signal turns SELL/STRONG SELL.
//
// Entry used to fire on BUY too (score>=55). A backtest sweep over the
// entry bar (2024-12 to now, same exit rule throughout) found returns
// rising monotonically with a stricter bar — score>=55 (old rule): -0.8%;
// >=70 (STRONG BUY): +38.4%; >=80: +47.7% — and >=70 held up as the
// better choice in BOTH halves of the window tested separately, not just
// on average. >=70 was picked over an even stricter, marginally higher-
// scoring bar because it's an existing, already-displayed signal tier
// rather than a new number chosen purely because it scored best here —
// picking the number that backtests best, out of many tried, is how you
// overfit to one dataset's noise. Not proof of a forward edge (it's the
// same 2 years being both explored and "confirmed" on — Yahoo's free
// history doesn't go further back for a true holdout), but it's the most
// scrutiny this dataset allows, and the mechanism is intuitive: score>=55
// let in a lot of marginal, quickly-reversed signals that mostly just paid
// their own trading costs.
//
// Two entry-side FILTERS on top of the STRONG BUY bar were tested
// (src/research/runEntryFilterSweep.ts, 2026-10-27) and both REJECTED for
// failing the same both-halves-robust bar as above:
//  - "Overextension brake" (skip entry if price is already far above its
//    50-day average): every cap tried (+10/15/20/25%) was worse than no
//    cap in the second half of the test window, even though a look at
//    TSLA alone that same day suggested the opposite. A single stock's
//    history is not the universe's history — this is exactly why every
//    change here gets tested across all 167 tickers, not one.
//  - "Market-regime filter" (skip new entries while QQQ is below its own
//    50-day average): looked good on the full-period average (+18.8% vs
//    +13.4%) and strong in the first half (+14.1% vs +1.4%), but lost that
//    edge entirely in the second half (+4.0% vs +11.2%) — the kind of
//    average-looks-great-but-isn't-robust result this file's methodology
//    exists to catch before it ships.
// No live change from either. Worth revisiting if a future idea can be
// combined with one of these rather than used alone, but not on their own.
//
// Exit used to fire the moment a held ticker dropped off BUY/STRONG BUY
// entirely — i.e. a plain fade to HOLD sold it, same as an actual SELL
// signal would. A live account's trade log (Oct 2026) showed exactly the
// failure mode that invites: round trips closing in 1-3 days for a small
// loss whenever a holding's score dipped just under the BUY cutoff and
// bounced back days later — a threshold with no confirmation, whipsawing
// on noise near the boundary. A sweep (src/research/runPaperBotSweep.ts,
// same full-universe, same entry rule and risk stops, only this exit
// condition varied, 2025-01 to 2026-10, split in half) compared the old
// rule against only selling on an actual SELL/STRONG SELL signal: the old
// rule was the ONLY variant that lost money in either half (-3.1% in the
// first, recovered to +15.8% in the second, +8.4% averaged) — two
// confirmation-based alternatives scored higher on average, but only by
// introducing a tunable day-count (2-day confirm, 5-day minimum hold)
// chosen from trying just two values, which is closer to the overfitting
// this file already avoids elsewhere. Requiring an actual SELL-family
// signal adds no new number to pick — it was positive in BOTH halves
// (+8.5%, +1.4%) and cut whipsaw-length (<=3 day) trades from 24% to 12%
// of all closed trades. Same caveats as the entry-bar sweep: 2 years of
// Yahoo history, not a true untouched holdout, relative comparison
// between rules rather than a proven forward edge.
export async function maybeTrade(
  userId: number,
  ticker: string,
  signal: string,
  price: number,
  timestamp: string
): Promise<void> {
  if (!price || price <= 0) return;

  const qualifiesForEntry = signal === "STRONG BUY";
  const qualifiesForExit = signal === "SELL" || signal === "STRONG SELL";
  const position = await getOpenPosition("auto", userId, ticker);

  if (qualifiesForEntry && !position) {
    const cash = await getCash("auto", userId);
    const spend = Math.min(ALLOCATION_USD, cash);
    if (spend < MIN_CASH_TO_TRADE) return;
    const shares = spend / price;
    await recordTrade("auto", userId, ticker, "BUY", shares, price, timestamp, signal);
    await setCash("auto", userId, cash - spend);
    await markStarted("auto", userId, timestamp);
    return;
  }

  if (qualifiesForExit && position) {
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
