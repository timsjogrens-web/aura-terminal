import { db, getMeta, setMeta } from "./db";

// A simulated portfolio that automatically "trades" the exact signals the
// engine produces — no manual entry, so the P&L is an honest readout of
// what following the signals would have actually done, not a cherry-picked
// example. Starting cash and all positions are fictional and clearly
// labeled as such everywhere they're displayed.
export const STARTING_CASH = 100_000;
const ALLOCATION_USD = 5_000; // fixed size per new position, ~5% of starting cash
const MIN_CASH_TO_TRADE = 100;

const CASH_KEY = "paper_cash";
const STARTED_KEY = "paper_started_at";

export interface PaperTrade {
  id: number;
  ticker: string;
  action: "BUY" | "SELL";
  shares: number;
  price: number;
  timestamp: string;
  reason: string;
}

async function getCash(): Promise<number> {
  const raw = await getMeta(CASH_KEY);
  return raw !== null ? Number(raw) : STARTING_CASH;
}

async function getOpenPosition(ticker: string): Promise<{ shares: number; entryPrice: number } | null> {
  const res = await db.execute({
    sql: "SELECT action, shares, price FROM paper_trades WHERE ticker = ? ORDER BY id DESC LIMIT 1",
    args: [ticker],
  });
  const row = res.rows[0] as { action: string; shares: number; price: number } | undefined;
  if (!row || row.action !== "BUY") return null;
  return { shares: Number(row.shares), entryPrice: Number(row.price) };
}

// Called right after refresh.ts detects a real signal transition. Buys a
// fixed-dollar position the moment a ticker newly reaches STRONG BUY (if
// not already held and cash allows it); sells the full position the moment
// a held ticker drops off BUY/STRONG BUY. Deliberately mirrors the signal
// engine 1:1 rather than adding its own timing logic on top.
export async function maybeTrade(
  ticker: string,
  signal: string,
  price: number,
  timestamp: string
): Promise<void> {
  if (!price || price <= 0) return;

  const isBuySignal = signal === "STRONG BUY" || signal === "BUY";
  const position = await getOpenPosition(ticker);

  if (isBuySignal && !position) {
    const cash = await getCash();
    const spend = Math.min(ALLOCATION_USD, cash);
    if (spend < MIN_CASH_TO_TRADE) return;
    const shares = spend / price;
    await db.execute({
      sql: "INSERT INTO paper_trades (ticker, action, shares, price, timestamp, reason) VALUES (?, 'BUY', ?, ?, ?, ?)",
      args: [ticker, shares, price, timestamp, signal],
    });
    await setMeta(CASH_KEY, String(cash - spend));
    if ((await getMeta(STARTED_KEY)) === null) {
      await setMeta(STARTED_KEY, timestamp);
    }
    return;
  }

  if (!isBuySignal && position) {
    const proceeds = position.shares * price;
    await db.execute({
      sql: "INSERT INTO paper_trades (ticker, action, shares, price, timestamp, reason) VALUES (?, 'SELL', ?, ?, ?, ?)",
      args: [ticker, position.shares, price, timestamp, signal],
    });
    const cash = await getCash();
    await setMeta(CASH_KEY, String(cash + proceeds));
  }
}

export interface OpenPosition {
  ticker: string;
  shares: number;
  entryPrice: number;
  entryDate: string;
}

export async function getPaperPortfolioState(): Promise<{
  cash: number;
  startedAt: string | null;
  trades: PaperTrade[];
  openPositions: OpenPosition[];
}> {
  const cash = await getCash();
  const startedAt = await getMeta(STARTED_KEY);

  const tradesRes = await db.execute(
    "SELECT id, ticker, action, shares, price, timestamp, reason FROM paper_trades ORDER BY timestamp DESC"
  );
  const trades = tradesRes.rows as unknown as PaperTrade[];

  const openByTicker = new Map<string, OpenPosition>();
  for (const t of [...trades].reverse()) {
    if (t.action === "BUY") {
      openByTicker.set(t.ticker, {
        ticker: t.ticker,
        shares: Number(t.shares),
        entryPrice: Number(t.price),
        entryDate: t.timestamp,
      });
    } else {
      openByTicker.delete(t.ticker);
    }
  }

  return { cash, startedAt, trades, openPositions: Array.from(openByTicker.values()) };
}
