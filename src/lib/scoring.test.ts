import { describe, it, expect } from "vitest";
import { sma, rsi, computeScore } from "./scoring";

describe("sma", () => {
  it("averages exactly the last `period` values", () => {
    expect(sma([1, 2, 3, 4, 5], 5)).toBe(3);
    expect(sma([10, 20, 30], 2)).toBe(25); // (20+30)/2
  });

  it("returns null when there isn't enough history", () => {
    expect(sma([1, 2], 5)).toBeNull();
  });
});

describe("rsi", () => {
  it("is 100 for a strictly increasing series (all gains, zero losses)", () => {
    const closes = Array.from({ length: 15 }, (_, i) => i + 1); // 1..15
    expect(rsi(closes, 14)).toBe(100);
  });

  it("is 0 for a strictly decreasing series (all losses, zero gains)", () => {
    const closes = Array.from({ length: 15 }, (_, i) => 15 - i); // 15..1
    expect(rsi(closes, 14)).toBe(0);
  });

  it("returns null when there isn't enough history", () => {
    expect(rsi([1, 2, 3], 14)).toBeNull();
  });
});

describe("computeScore", () => {
  it("matches a hand-calculated result for known inputs", () => {
    // price 10% above SMA50 -> trend component maxes out at the full 40pt weight
    //   clamp(40/2 + 10*(40/20), 0, 40) = clamp(20+20, 0, 40) = 40
    // RSI 60 falls in the 30-65 "ramping up" band ->
    //   score01 = 0.3 + ((60-30)/35)*0.7 = 0.3 + 0.6 = 0.9 -> 0.9*30 = 27
    // volume at 2x its average -> (2.0-0.5)/1.5 = 1.0 -> full 30pt weight
    // score = round((40+27+30)/(40+30+30)*100) = round(97) = 97 -> STRONG BUY
    const result = computeScore({ price: 110, sma50: 100, rsi14: 60, volume: 200, avgVolume: 100 });
    expect(result.trendComponent).toBe(40);
    expect(result.momentumComponent).toBeCloseTo(27, 10); // floating-point, not exactly 27
    expect(result.volumeComponent).toBe(30);
    expect(result.score).toBe(97);
    expect(result.signal).toBe("STRONG BUY");
  });

  it("drops a missing component and rescales over the rest, rather than inventing a value", () => {
    // No volume data at all -> only trend (40) + momentum (30) count, 70 total weight.
    // Same trend/momentum inputs as above: trendComponent=40, momentumComponent=27.
    // score = round((40+27)/70*100) = round(95.71) = 96
    const result = computeScore({ price: 110, sma50: 100, rsi14: 60, volume: null, avgVolume: null });
    expect(result.volumeComponent).toBeNull();
    expect(result.score).toBe(96);
  });

  it("custom weights change the score without changing the underlying math", () => {
    // Same inputs as the first test, but momentum weighted at 0 -> it's excluded entirely.
    const result = computeScore(
      { price: 110, sma50: 100, rsi14: 60, volume: 200, avgVolume: 100 },
      { trend: 40, momentum: 0, volume: 30 }
    );
    // trend maxes at 40 (weight/2 + 10*(weight/20) = 20+20=40), volume maxes at 30.
    // score = round((40+30)/70*100) = round(100) = 100
    expect(result.score).toBe(100);
  });
});
