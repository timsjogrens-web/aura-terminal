import { STARTING_CASH, getCash, setCash, markStarted, getOpenPosition, recordTrade, getPortfolioState } from "./portfolio";

export { STARTING_CASH };
export type { Trade as ManualTrade, OpenPosition } from "./portfolio";

export class ManualTradeError extends Error {}

// Unlike the auto bot (always one all-in buy, one all-out sell), a manual
// trade behaves like an actual brokerage ticket: buy N more shares, or
// sell N of what you hold. Position size and average cost are derived by
// replaying the full trade log (see portfolio.ts), so each call here just
// needs to log the real shares transacted in this one trade — scoped to
// the one user placing it.
export async function executeManualTrade(
  userId: number,
  ticker: string,
  action: "BUY" | "SELL",
  shares: number,
  price: number
): Promise<void> {
  if (!Number.isFinite(shares) || shares <= 0) {
    throw new ManualTradeError("Enter a share quantity greater than zero.");
  }
  if (!price || price <= 0) {
    throw new ManualTradeError("No live price available for this ticker right now.");
  }

  const now = new Date().toISOString();
  const cash = await getCash("manual", userId);

  if (action === "BUY") {
    const cost = shares * price;
    if (cost > cash) {
      throw new ManualTradeError(`Not enough cash: this costs $${cost.toFixed(2)}, you have $${cash.toFixed(2)}.`);
    }
    await recordTrade("manual", userId, ticker, "BUY", shares, price, now, null);
    await setCash("manual", userId, cash - cost);
    await markStarted("manual", userId, now);
    return;
  }

  const position = await getOpenPosition("manual", userId, ticker);
  const held = position?.shares ?? 0;
  if (shares > held + 1e-6) {
    throw new ManualTradeError(`You only hold ${held.toFixed(4)} shares of ${ticker}.`);
  }
  const proceeds = shares * price;
  await recordTrade("manual", userId, ticker, "SELL", shares, price, now, null);
  await setCash("manual", userId, cash + proceeds);
}

export async function getManualPortfolioState(userId: number) {
  return getPortfolioState("manual", userId);
}
