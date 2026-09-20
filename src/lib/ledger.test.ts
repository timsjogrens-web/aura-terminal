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
    expect(verifyChain(rows, [])).toEqual({ valid: true, totalRows: 10, brokenAtId: null, acceptedForks: 0 });
  });

  it("accepts an empty ledger", () => {
    expect(verifyChain([], [])).toEqual({ valid: true, totalRows: 0, brokenAtId: null, acceptedForks: 0 });
  });

  it("detects a single field changed on a past row (e.g. score edited after the fact)", () => {
    const rows = buildChain(10);
    rows[4] = { ...rows[4], score: 999 }; // tamper with row id=5, don't touch its stored hash
    const result = verifyChain(rows, []);
    expect(result.valid).toBe(false);
    expect(result.brokenAtId).toBe(5);
  });

  it("detects a deleted row (chain no longer lines up)", () => {
    const rows = buildChain(10);
    rows.splice(4, 1); // remove row id=5 entirely
    const result = verifyChain(rows, []);
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
    const result = verifyChain(rows, []);
    expect(result.valid).toBe(false);
    expect(result.brokenAtId).toBe(6);
  });
});

function mkRow(id: number, prevHash: string, score: number): LedgerRow {
  const f = {
    ticker: "AAPL",
    score,
    signal: "BUY",
    price: 100 + id,
    modelVersion: MODEL_VERSION,
    timestamp: `2026-01-01T00:00:${String(id).padStart(2, "0")}.000Z`,
  };
  return {
    id,
    ticker: f.ticker,
    score: f.score,
    signal: f.signal,
    price: f.price,
    model_version: f.modelVersion,
    timestamp: f.timestamp,
    prev_hash: prevHash,
    row_hash: computeRowHash(prevHash, f),
  };
}

// Rows 1-2 chain normally; row 3 and row 4 were written concurrently and
// BOTH chain onto row 2 — row 4 (the later id, so the one the next append
// sees as "latest") is what row 5 builds on, which leaves row 3 a dead end.
// This is the shape the old non-atomic append left behind.
function forkedChain() {
  const r1 = mkRow(1, GENESIS_HASH, 60);
  const r2 = mkRow(2, r1.row_hash, 61);
  const dead = mkRow(3, r2.row_hash, 99);
  const r4 = mkRow(4, r2.row_hash, 62);
  const r5 = mkRow(5, r4.row_hash, 63);
  return { rows: [r1, r2, dead, r4, r5], dead };
}

describe("verifyChain with known concurrent-write forks", () => {
  it("rejects an unexplained fork, but accepts a pinned one", () => {
    const { rows, dead } = forkedChain();
    expect(verifyChain(rows, []).valid).toBe(false);
    const ok = verifyChain(rows, [{ deadEndId: dead.id, deadEndHash: dead.row_hash }]);
    expect(ok).toEqual({ valid: true, totalRows: 5, brokenAtId: null, acceptedForks: 1 });
  });

  it("still catches a pinned dead-end row being edited", () => {
    const { rows, dead } = forkedChain();
    const edited = rows.map((r) => (r.id === dead.id ? { ...r, score: 1 } : r));
    const result = verifyChain(edited, [{ deadEndId: dead.id, deadEndHash: dead.row_hash }]);
    expect(result.valid).toBe(false);
    expect(result.brokenAtId).toBe(dead.id);
  });

  it("still catches a pinned dead-end row being deleted, even though the rest links up", () => {
    const { rows, dead } = forkedChain();
    const without = rows.filter((r) => r.id !== dead.id);
    expect(verifyChain(without, []).valid).toBe(true); // nothing pinned -> nothing to miss
    const result = verifyChain(without, [{ deadEndId: dead.id, deadEndHash: dead.row_hash }]);
    expect(result.valid).toBe(false);
    expect(result.brokenAtId).toBe(dead.id);
  });

  it("does not let the pin excuse a different, unlisted break", () => {
    const { rows, dead } = forkedChain();
    const tampered = rows.map((r) => (r.id === 4 ? { ...r, score: 5 } : r));
    const result = verifyChain(tampered, [{ deadEndId: dead.id, deadEndHash: dead.row_hash }]);
    expect(result.valid).toBe(false);
    expect(result.brokenAtId).toBe(4);
  });
});
