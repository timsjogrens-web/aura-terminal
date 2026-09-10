import { describe, it, expect } from "vitest";
import { runBacktestFromCandles } from "./backtest";
import { DEFAULT_WEIGHTS } from "./scoring";
import type { DailyCandles } from "./yahoo";

const BASE_TS = 1_700_000_000; // arbitrary fixed epoch seconds — deterministic, no real clock involved

// A controllable, fully deterministic daily-close pattern: a mild sawtooth
// (so SMA/RSI see real variation, not a flat line) for `warmupDays`, then a
// sustained rally for `rallyDays` — reliably produces a BUY-family
// transition partway through, without depending on any live data.
function buildSyntheticCandles(warmupDays: number, rallyDays: number, tailDays = 0): DailyCandles {
  const n = warmupDays + rallyDays + tailDays;
  const closes: number[] = [];
  for (let i = 0; i < n; i++) {
    if (i < warmupDays) {
      closes.push(100 + (i % 2 === 0 ? 1 : -1)); // sawtooth around 100
    } else if (i < warmupDays + rallyDays) {
      const rallyIdx = i - warmupDays;
      closes.push(100 + rallyIdx * 3); // steady climb
    } else {
      const tailIdx = i - warmupDays - rallyDays;
      closes.push(100 + rallyDays * 3 - tailIdx * 5); // sharp reversal, for the tail-divergence test
    }
  }
  const opens = closes.map((c, i) => (i === 0 ? c : closes[i - 1])); // open ~= prior close, close enough for these tests
  const volumes = closes.map(() => 5_000_000); // constant, high — keeps liquidity tier fixed and irrelevant to the assertions
  const timestamps = closes.map((_, i) => BASE_TS + i * 86_400);
  return { closes, adjCloses: closes, opens, volumes, timestamps };
}

describe("runBacktestFromCandles — look-ahead sanity", () => {
  it("produces at least one BUY-family transition to test against", () => {
    const candles = buildSyntheticCandles(55, 15);
    const result = runBacktestFromCandles("TEST", candles, DEFAULT_WEIGHTS, "2Y");
    expect(result.rows.some((r) => r.signal.includes("BUY"))).toBe(true);
  });

  it("never executes a trade on or before the day the signal itself fired", () => {
    // This is the exact bug that was fixed: a signal used to "trade" at
    // the same close it was computed from. If that regresses, this fails.
    const candles = buildSyntheticCandles(55, 15);
    const result = runBacktestFromCandles("TEST", candles, DEFAULT_WEIGHTS, "2Y");
    const executed = result.rows.filter((r) => r.execDate !== null);
    expect(executed.length).toBeGreaterThan(0);
    for (const row of executed) {
      expect(new Date(row.execDate!).getTime()).toBeGreaterThan(new Date(row.date).getTime());
    }
  });

  it("HOLD signals never execute or get scored — there's nothing to trade", () => {
    const candles = buildSyntheticCandles(55, 15);
    const result = runBacktestFromCandles("TEST", candles, DEFAULT_WEIGHTS, "2Y");
    const holds = result.rows.filter((r) => r.signal === "HOLD");
    expect(holds.length).toBeGreaterThan(0); // sanity: the sawtooth warmup should produce some
    for (const row of holds) {
      expect(row.execPrice).toBeNull();
      expect(row.outcome).toBeNull();
    }
  });

  it("a signal's score never changes depending on data that comes after it", () => {
    // The actual look-ahead test: build two candle sets that are IDENTICAL
    // up through day 65, then diverge completely (one keeps rallying, the
    // other reverses hard). If computeScore for day 60 differs between the
    // two runs, something is leaking future data into that day's decision.
    const shortRun = buildSyntheticCandles(55, 15); // 70 days total, rally throughout
    const longRunReversed = buildSyntheticCandles(55, 15, 30); // same first 70 days, then a sharp reversal

    const resultShort = runBacktestFromCandles("TEST", shortRun, DEFAULT_WEIGHTS, "2Y");
    const resultLong = runBacktestFromCandles("TEST", longRunReversed, DEFAULT_WEIGHTS, "2Y");

    // Compare every row from the short run against the same date in the long run.
    expect(resultShort.rows.length).toBeGreaterThan(0);
    for (const shortRow of resultShort.rows) {
      const longRow = resultLong.rows.find((r) => r.date === shortRow.date);
      expect(longRow, `no matching row for ${shortRow.date} in the extended run`).toBeDefined();
      expect(longRow!.score).toBe(shortRow.score);
      expect(longRow!.signal).toBe(shortRow.signal);
    }
  });

  it("applies a real cost to every executed trade — nothing trades at the raw quoted price", () => {
    const candles = buildSyntheticCandles(55, 15);
    const result = runBacktestFromCandles("TEST", candles, DEFAULT_WEIGHTS, "2Y");
    const executedBuys = result.rows.filter((r) => r.signal.includes("BUY") && r.execPrice !== null);
    expect(executedBuys.length).toBeGreaterThan(0);
    for (const row of executedBuys) {
      // A BUY should always cost strictly more than the unadjusted open it traded at.
      const execDateIdx = candles.timestamps.findIndex(
        (t) => new Date(t * 1000).toISOString().slice(0, 10) === row.execDate
      );
      expect(row.execPrice).toBeGreaterThan(candles.opens[execDateIdx]);
    }
  });
});
