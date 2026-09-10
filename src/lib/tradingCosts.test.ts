import { describe, it, expect } from "vitest";
import { slippageBps, oneWayCostFraction, TRADING_COSTS } from "./tradingCosts";

describe("slippageBps", () => {
  it("picks the tier matching the given dollar volume", () => {
    expect(slippageBps(2_000_000_000)).toBe(5); // >$1B/day
    expect(slippageBps(1_000_000_000)).toBe(5); // exactly the boundary counts as the liquid tier
    expect(slippageBps(500_000_000)).toBe(10); // $100M-$1B
    expect(slippageBps(50_000_000)).toBe(25); // below $100M
  });

  it("assumes the worst tier when liquidity is unknown, rather than the best", () => {
    expect(slippageBps(null)).toBe(25);
  });
});

describe("oneWayCostFraction", () => {
  it("matches a hand-calculated total for a liquid stock", () => {
    // default config: 0% commission + 0.25% FX + 5bps (0.05%) slippage for >$1B ADV
    expect(TRADING_COSTS.commissionPct).toBe(0);
    expect(TRADING_COSTS.fxFeePctPerConversion).toBe(0.25);
    const cost = oneWayCostFraction(2_000_000_000);
    expect(cost).toBeCloseTo(0.003, 10); // 0.25% + 0.05% = 0.30% = 0.003
  });

  it("is higher for an illiquid stock — same commission/FX, worse slippage", () => {
    // 0% + 0.25% + 25bps (0.25%) = 0.50%
    const cost = oneWayCostFraction(1_000_000);
    expect(cost).toBeCloseTo(0.005, 10);
  });
});
