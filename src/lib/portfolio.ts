import { db, getMeta, setMeta } from "./db";

// Shared mechanics behind both simulated portfolios — the auto bot
// (paperTrading.ts, driven by signal transitions) and the manual "self
// trade" one (manualTrading.ts, driven by explicit user clicks). Same
// bookkeeping either way: one open lot per ticker at a time, cash tracked
// in `meta`, trades logged to their own table. Only how a trade gets
// triggered differs between the two.
export const STARTING_CASH = 100_000;

export type PortfolioKind = "auto" | "manual";

const CONFIG: Record<PortfolioKind, { table: string; cashKey: string; startedKey: string }> = {
  auto: { table: "paper_trades", cashKey: "paper_cash", startedKey: "paper_started_at" },
  manual: { table: "manual_trades", cashKey: "manual_cash", startedKey: "manual_started_at" },
};

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

export async function getCash(kind: PortfolioKind): Promise<number> {
  const raw = await getMeta(CONFIG[kind].cashKey);
  return raw !== null ? Number(raw) : STARTING_CASH;
}

export async function setCash(kind: PortfolioKind, value: number): Promise<void> {
  await setMeta(CONFIG[kind].cashKey, String(value));
}

export async function markStarted(kind: PortfolioKind, timestamp: string): Promise<void> {
  if ((await getMeta(CONFIG[kind].startedKey)) === null) {
    await setMeta(CONFIG[kind].startedKey, timestamp);
  }
}

export async function recordTrade(
  kind: PortfolioKind,
  ticker: string,
  action: "BUY" | "SELL",
  shares: number,
  price: number,
  timestamp: string,
  reason: string | null
): Promise<void> {
  await db.execute({
    sql: `INSERT INTO ${CONFIG[kind].table} (ticker, action, shares, price, timestamp, reason) VALUES (?, ?, ?, ?, ?, ?)`,
    args: [ticker, action, shares, price, timestamp, reason],
  });
}

// Reconstructs net position + weighted-average cost basis per ticker by
// replaying every trade in order, rather than trusting only the latest
// row — the auto bot only ever does one all-in buy then one all-out sell
// per ticker, but manual trading allows partial buys/sells that build up
// or trim a position over several trades, and only a full replay gets the
// resulting size and average cost right in that case.
export async function getPortfolioState(kind: PortfolioKind): Promise<{
  cash: number;
  startedAt: string | null;
  trades: Trade[];
  openPositions: OpenPosition[];
}> {
  const cash = await getCash(kind);
  const startedAt = await getMeta(CONFIG[kind].startedKey);

  const tradesRes = await db.execute(
    `SELECT id, ticker, action, shares, price, timestamp, reason FROM ${CONFIG[kind].table} ORDER BY timestamp ASC, id ASC`
  );
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
  ticker: string
): Promise<{ shares: number; entryPrice: number } | null> {
  const state = await getPortfolioState(kind);
  const pos = state.openPositions.find((p) => p.ticker === ticker);
  return pos ? { shares: pos.shares, entryPrice: pos.entryPrice } : null;
}
