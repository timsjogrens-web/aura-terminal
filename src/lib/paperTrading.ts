import {
  STARTING_CASH,
  getCash,
  setCash,
  markStarted,
  getOpenPosition,
  recordTrade,
  getPortfolioState,
} from "./portfolio";

export { STARTING_CASH };
export type { Trade as PaperTrade, OpenPosition } from "./portfolio";

const ALLOCATION_USD = 5_000; // fixed size per new position, ~5% of starting cash
const MIN_CASH_TO_TRADE = 100;

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
  const position = await getOpenPosition("auto", ticker);

  if (isBuySignal && !position) {
    const cash = await getCash("auto");
    const spend = Math.min(ALLOCATION_USD, cash);
    if (spend < MIN_CASH_TO_TRADE) return;
    const shares = spend / price;
    await recordTrade("auto", ticker, "BUY", shares, price, timestamp, signal);
    await setCash("auto", cash - spend);
    await markStarted("auto", timestamp);
    return;
  }

  if (!isBuySignal && position) {
    const proceeds = position.shares * price;
    await recordTrade("auto", ticker, "SELL", position.shares, price, timestamp, signal);
    const cash = await getCash("auto");
    await setCash("auto", cash + proceeds);
  }
}

export async function getPaperPortfolioState() {
  return getPortfolioState("auto");
}
