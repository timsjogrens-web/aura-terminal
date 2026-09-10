import { describe, it, expect } from "vitest";
import { computeRowHash, verifyChain, GENESIS_HASH, MODEL_VERSION, LedgerRow } from "./ledger";

function buildChain(n: number): LedgerRow[] {
  const rows: LedgerRow[] = [];
  let prevHash = GENESIS_HASH;
  for (let i = 0; i < n; i++) {
    const fields = {
      ticker: "AAPL",
      score: 60 + i,
      signal: "BUY",
      price: 100 + i,
      modelVersion: MODEL_VERSION,
      timestamp: `2026-01-${String(i + 1).padStart(2, "0")}T00:00:00.000Z`,
    };
    const rowHash = computeRowHash(prevHash, fields);
    rows.push({
      id: i + 1,
      ticker: fields.ticker,
      score: fields.score,
      signal: fields.signal,
      price: fields.price,
      model_version: fields.modelVersion,
      timestamp: fields.timestamp,
      prev_hash: prevHash,
      row_hash: rowHash,
    });
    prevHash = rowHash;
  }
  return rows;
}

describe("verifyChain", () => {
  it("accepts a genuinely untampered chain", () => {
    const rows = buildChain(10);
    expect(verifyChain(rows)).toEqual({ valid: true, totalRows: 10, brokenAtId: null });
  });

  it("accepts an empty ledger", () => {
    expect(verifyChain([])).toEqual({ valid: true, totalRows: 0, brokenAtId: null });
  });

  it("detects a single field changed on a past row (e.g. score edited after the fact)", () => {
    const rows = buildChain(10);
    rows[4] = { ...rows[4], score: 999 }; // tamper with row id=5, don't touch its stored hash
    const result = verifyChain(rows);
    expect(result.valid).toBe(false);
    expect(result.brokenAtId).toBe(5);
  });

  it("detects a deleted row (chain no longer lines up)", () => {
    const rows = buildChain(10);
    rows.splice(4, 1); // remove row id=5 entirely
    const result = verifyChain(rows);
    expect(result.valid).toBe(false);
    expect(result.brokenAtId).toBe(6); // the next row's prev_hash no longer matches
  });

  it("detects an attacker who edits a row AND recomputes its own hash, but can't fix the NEXT row", () => {
    // A naive attacker updates row 5's data and its own row_hash so THAT
    // row looks self-consistent — but row 6's prev_hash still points to
    // the OLD (correct) hash of row 5, so the chain still breaks.
    const rows = buildChain(10);
    const tamperedFields = {
      ticker: rows[4].ticker,
      score: 999,
      signal: rows[4].signal,
      price: rows[4].price,
      modelVersion: rows[4].model_version,
      timestamp: rows[4].timestamp,
    };
    rows[4] = {
      ...rows[4],
      score: 999,
      row_hash: computeRowHash(rows[4].prev_hash, tamperedFields),
    };
    const result = verifyChain(rows);
    expect(result.valid).toBe(false);
    expect(result.brokenAtId).toBe(6);
  });
});
