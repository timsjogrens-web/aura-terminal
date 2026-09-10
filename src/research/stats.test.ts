import { describe, it, expect } from "vitest";
import {
  cagr,
  maxDrawdown,
  alphaBeta,
  normalCdf,
  normalInvCdf,
  sharpeRatio,
  deflatedSharpeRatio,
} from "./stats";

describe("cagr", () => {
  it("is exactly 100% for a series that doubles over 12 months", () => {
    const prices = Array.from({ length: 13 }, (_, i) => 100 * Math.pow(2, i / 12));
    expect(cagr(prices)).toBeCloseTo(1.0, 6);
  });
});

describe("maxDrawdown", () => {
  it("is 0 for a monotonically increasing series", () => {
    expect(maxDrawdown([100, 110, 120, 130])).toBe(0);
  });

  it("finds a -50% drawdown correctly", () => {
    expect(maxDrawdown([100, 200, 100, 150])).toBeCloseTo(-0.5, 10);
  });
});

describe("alphaBeta", () => {
  it("gives beta=1, alpha=0 when the strategy IS the benchmark", () => {
    const rets = [0.01, -0.02, 0.03, 0.015, -0.005, 0.02];
    const result = alphaBeta(rets, rets);
    expect(result.beta).toBeCloseTo(1, 6);
    expect(result.alphaAnnual).toBeCloseTo(0, 6);
  });

  it("gives beta=2 for a 2x-levered clone of the benchmark", () => {
    const bench = [0.01, -0.02, 0.03, 0.015, -0.005, 0.02];
    const strat = bench.map((r) => r * 2);
    const result = alphaBeta(strat, bench);
    expect(result.beta).toBeCloseTo(2, 6);
  });
});

describe("normalCdf / normalInvCdf", () => {
  it("round-trips known quantiles", () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 4);
    expect(normalCdf(1.959964)).toBeCloseTo(0.975, 4);
    expect(normalInvCdf(0.5)).toBeCloseTo(0, 3);
    expect(normalInvCdf(0.975)).toBeCloseTo(1.959964, 3);
  });
});

describe("sharpeRatio", () => {
  it("is 0 for a flat (zero-return) series", () => {
    expect(sharpeRatio([0, 0, 0, 0])).toBe(0);
  });
});

describe("deflatedSharpeRatio", () => {
  it("is lower for more trials, all else equal — that's the whole point", () => {
    // A moderately good but not spectacular return series.
    const rets = Array.from({ length: 60 }, (_, i) => 0.01 + 0.03 * Math.sin(i));
    const dsrFewTrials = deflatedSharpeRatio(rets, 1);
    const dsrManyTrials = deflatedSharpeRatio(rets, 50);
    expect(dsrManyTrials).toBeLessThan(dsrFewTrials);
  });
});
