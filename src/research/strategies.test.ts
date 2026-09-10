import { describe, it, expect } from "vitest";
import { momentumScorer, lowVolScorer, runFactorStrategy, runCompositeRankStrategy } from "./strategies";
import type { MonthlySeries } from "./fetchHistory";

describe("momentumScorer", () => {
  it("matches a hand-calculated 12-1 return", () => {
    // idx=12 uses prices[0] (12 months ago) and prices[11] (1 month ago).
    const prices = [100, ...Array(10).fill(100), 120, 150]; // prices[0]=100, prices[11]=120, prices[12]=150
    // 12-1 momentum at idx=12: prices[11]/prices[0] - 1 = 120/100 - 1 = 0.20
    expect(momentumScorer(prices, 12)).toBeCloseTo(0.2, 10);
  });

  it("returns null before there's 12 months of history", () => {
    expect(momentumScorer([100, 110], 1)).toBeNull();
  });
});

describe("lowVolScorer", () => {
  it("is less negative (better) for a steadier series", () => {
    const steady = [100, 101, 100, 101, 100, 101, 100, 101, 100, 101, 100, 101, 100];
    const volatile = [100, 130, 90, 140, 80, 150, 70, 160, 60, 170, 50, 180, 40];
    const steadyScore = lowVolScorer(steady, 12)!;
    const volatileScore = lowVolScorer(volatile, 12)!;
    expect(steadyScore).toBeGreaterThan(volatileScore);
  });
});

function buildPanel(overrides: Record<string, number[]>): MonthlySeries {
  const months = Array.from({ length: 30 }, (_, i) => `2020-${String((i % 12) + 1).padStart(2, "0")}`);
  return { months, prices: overrides, fetchedAt: "2020-01-01", excludedTickers: [] };
}

describe("runFactorStrategy — look-ahead safety", () => {
  it("never lets a decision depend on data after the month it's made in", () => {
    // Two FULL panels sharing an identical first 21 months (indices 0-20),
    // then diverging completely — A and B's trajectories are swapped after
    // that point. Both are run end-to-end over the full range. If a
    // decision made at a shared-prefix month secretly depended on data
    // that comes later, the two panels' holdings for that month would
    // differ once the (different) future actually arrives.
    const shared = Array.from({ length: 21 }, (_, i) => 100 + i * 2);
    const railA1 = [...shared, ...Array.from({ length: 9 }, (_, i) => shared[20] + i * 5)];
    const railB1 = [...shared, ...Array.from({ length: 9 }, (_, i) => shared[20] - i * 3)];
    const railA2 = [...shared, ...Array.from({ length: 9 }, (_, i) => shared[20] - i * 8)]; // swapped trajectory
    const railB2 = [...shared, ...Array.from({ length: 9 }, (_, i) => shared[20] + i * 6)];
    const flatC = Array(30).fill(100);

    const panel1 = buildPanel({ A: railA1, B: railB1, C: flatC });
    const panel2 = buildPanel({ A: railA2, B: railB2, C: flatC });

    const result1 = runFactorStrategy(panel1, momentumScorer, 2, 12, 30);
    const result2 = runFactorStrategy(panel2, momentumScorer, 2, 12, 30);

    // Decisions at idx 12..19 only ever look at prices[0..19] — entirely
    // within the identical first-21-months prefix — so they must match.
    expect(result1.holdings.length).toBeGreaterThan(8);
    for (let i = 0; i < 20 - 12; i++) {
      expect(result2.holdings[i]).toEqual(result1.holdings[i]);
    }
  });
});

describe("runCompositeRankStrategy", () => {
  it("only picks tickers scored on every factor", () => {
    const months = Array.from({ length: 20 }, (_, i) => `2020-${String((i % 12) + 1).padStart(2, "0")}`);
    // B has too little history for momentum (needs 12 months back), so it
    // should never be picked even though it might score well on low-vol.
    const panel: MonthlySeries = {
      months,
      prices: {
        A: Array.from({ length: 20 }, (_, i) => 100 + i * 3),
        B: Array.from({ length: 20 }, (_, i) => (i < 15 ? NaN : 100 + i)),
        C: Array(20).fill(100),
      },
      fetchedAt: "2020-01-01",
      excludedTickers: [],
    };
    const result = runCompositeRankStrategy(panel, [momentumScorer, lowVolScorer], 3, 12, 18);
    for (const h of result.holdings) {
      expect(h.tickers).not.toContain("B");
    }
  });
});
