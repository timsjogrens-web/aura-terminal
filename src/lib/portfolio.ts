import { db, getMeta, setMeta } from "./db";

// Shared mechanics behind both simulated portfolios — the auto bot
// (paperTrading.ts, driven by signal transitions) and the manual "self
// trade" one (manualTrading.ts, driven by explicit user clicks) — for
// EVERY user independently. Same bookkeeping either way: one open lot per
// ticker at a time, cash tracked in `meta` (keyed per user), trades logged
// to their own table (tagged with user_id). Only how a trade gets
// triggered differs between the two, and only whose account it's posted to
// differs between users.
export const STARTING_CASH = 100_000;

export type PortfolioKind = "auto" | "manual";

const CONFIG: Record<PortfolioKind, { table: string; cashKey: string; startedKey: string }> = {
  auto: { table: "paper_trades", cashKey: "paper_cash", startedKey: "paper_started_at" },
  manual: { table: "manual_trades", cashKey: "manual_cash", startedKey: "manual_started_at" },
};

// A brand new user has no meta row yet for either key — getCash/markStarted
// below already treat that as "starting fresh at STARTING_CASH, never
// started," which is exactly the $100k blank slate every new account
// should get, with no explicit account-creation step required.
function cashKey(kind: PortfolioKind, userId: number): string {
  return `${CONFIG[kind].cashKey}:${userId}`;
}
function startedKey(kind: PortfolioKind, userId: number): string {
  return `${CONFIG[kind].startedKey}:${userId}`;
}

export interface Trade {
  id: number;
  ticker: string;
  action: "BUY" | "SELL";
  shares: number;
  price: number;
  timestamp: string;
  reason: string | null;
}

export interface OpenPosition {
  ticker: string;
  shares: number;
  entryPrice: number;
  entryDate: string;
}

export async function getCash(kind: PortfolioKind, userId: number): Promise<number> {
  const raw = await getMeta(cashKey(kind, userId));
  return raw !== null ? Number(raw) : STARTING_CASH;
}

export async function setCash(kind: PortfolioKind, userId: number, value: number): Promise<void> {
  await setMeta(cashKey(kind, userId), String(value));
}

export async function markStarted(kind: PortfolioKind, userId: number, timestamp: string): Promise<void> {
  if ((await getMeta(startedKey(kind, userId))) === null) {
    await setMeta(startedKey(kind, userId), timestamp);
  }
}

export async function recordTrade(
  kind: PortfolioKind,
  userId: number,
  ticker: string,
  action: "BUY" | "SELL",
  shares: number,
  price: number,
  timestamp: string,
  reason: string | null
): Promise<void> {
  await db.execute({
    sql: `INSERT INTO ${CONFIG[kind].table} (user_id, ticker, action, shares, price, timestamp, reason) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [userId, ticker, action, shares, price, timestamp, reason],
  });
}

// Reconstructs net position + weighted-average cost basis per ticker by
// replaying every trade in order, rather than trusting only the latest
// row — the auto bot only ever does one all-in buy then one all-out sell
// per ticker, but manual trading allows partial buys/sells that build up
// or trim a position over several trades, and only a full replay gets the
// resulting size and average cost right in that case. Scoped to one
// user's own trades, so the replay only ever walks that one account's
// (small) history, not everyone's.
export async function getPortfolioState(
  kind: PortfolioKind,
  userId: number
): Promise<{
  cash: number;
  startedAt: string | null;
  trades: Trade[];
  openPositions: OpenPosition[];
}> {
  const cash = await getCash(kind, userId);
  const startedAt = await getMeta(startedKey(kind, userId));

  const tradesRes = await db.execute({
    sql: `SELECT id, ticker, action, shares, price, timestamp, reason FROM ${CONFIG[kind].table} WHERE user_id = ? ORDER BY timestamp ASC, id ASC`,
    args: [userId],
  });
  const trades = tradesRes.rows as unknown as Trade[];

  interface Accum {
    shares: number;
    costBasis: number;
    entryDate: string;
  }
  const positions = new Map<string, Accum>();
  for (const t of trades) {
    const shares = Number(t.shares);
    const price = Number(t.price);
    const existing = positions.get(t.ticker);
    if (t.action === "BUY") {
      if (existing) {
        existing.shares += shares;
        existing.costBasis += shares * price;
      } else {
        positions.set(t.ticker, { shares, costBasis: shares * price, entryDate: t.timestamp });
      }
    } else if (existing) {
      const avgPrice = existing.costBasis / existing.shares;
      existing.shares -= shares;
      existing.costBasis -= shares * avgPrice;
      if (existing.shares <= 1e-6) positions.delete(t.ticker);
    }
  }

  const openPositions: OpenPosition[] = Array.from(positions.entries())
    .filter(([, p]) => p.shares > 1e-6)
    .map(([ticker, p]) => ({
      ticker,
      shares: p.shares,
      entryPrice: p.costBasis / p.shares,
      entryDate: p.entryDate,
    }));

  return { cash, startedAt, trades: [...trades].reverse(), openPositions };
}

export async function getOpenPosition(
  kind: PortfolioKind,
  userId: number,
  ticker: string
): Promise<{ shares: number; entryPrice: number } | null> {
  const state = await getPortfolioState(kind, userId);
  const pos = state.openPositions.find((p) => p.ticker === ticker);
  return pos ? { shares: pos.shares, entryPrice: pos.entryPrice } : null;
}

// Which users currently hold an open "auto" (bot) position in a given
// ticker — used by the refresh loop to know whose account needs a
// sell/risk-exit check for that ticker, without replaying every bot
// user's whole trade history on every cycle. Only valid for the "auto"
// kind: it always does one all-in buy then one all-out sell per ticker
// (never partial), so "last trade for this (user, ticker) was a BUY"
// is exactly equivalent to "still holds it" — manual trading allows
// partial buys/sells and would need the full replay above instead.
export async function getAutoHolders(ticker: string): Promise<
  Array<{ userId: number; shares: number; entryPrice: number; entryDate: string }>
> {
  const res = await db.execute({
    sql: `
      SELECT pt.user_id, pt.shares, pt.price, pt.timestamp
      FROM paper_trades pt
      WHERE pt.ticker = ?
        AND pt.action = 'BUY'
        AND pt.id = (
          SELECT MAX(id) FROM paper_trades pt2 WHERE pt2.user_id = pt.user_id AND pt2.ticker = pt.ticker
        )
    `,
    args: [ticker],
  });
  return (res.rows as unknown as { user_id: number; shares: number; price: number; timestamp: string }[]).map(
    (r) => ({ userId: r.user_id, shares: Number(r.shares), entryPrice: Number(r.price), entryDate: r.timestamp })
  );
}
