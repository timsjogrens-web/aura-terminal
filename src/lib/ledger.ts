import { createHash } from "crypto";
import { db } from "./db";

// An append-only, hash-chained record of every signal the site has ever
// generated. Each row's hash depends on the previous row's hash, so
// altering or deleting a past row (to make a track record look better
// after the fact) breaks the chain from that point forward — anyone can
// verify it with verifyLedger() below, no trust required.
//
// This does NOT prevent tampering by someone with direct database access
// (there's no cryptographic signing key involved, just a hash chain) — it
// makes tampering DETECTABLE, which is the property that actually matters
// here: nobody, including the site's own operator, can quietly rewrite
// history without it showing up as a broken chain.
//
// Concurrency note: appending reads the last row's hash, then inserts —
// not atomic. Safe as long as signals are appended sequentially by a
// single writer (true today: refreshAll processes tickers one at a time
// with a delay between them). If refresh jobs ever run concurrently, this
// needs a real transaction or a compare-and-swap insert instead.

export const GENESIS_HASH = "0".repeat(64);

// Bump whenever computeScore's formula, weights, or thresholds change, so
// old ledger entries stay attributable to the model version that actually
// produced them (the brief's "model versioning" requirement).
export const MODEL_VERSION = "v1-sma50-rsi14-volume";

interface SignalFields {
  ticker: string;
  score: number;
  signal: string;
  price: number;
  modelVersion: string;
  timestamp: string;
}

export function computeRowHash(prevHash: string, f: SignalFields): string {
  const payload = [prevHash, f.ticker, f.score, f.signal, f.price, f.modelVersion, f.timestamp].join("|");
  return createHash("sha256").update(payload).digest("hex");
}

const LAST_HASH_SQL = `SELECT row_hash FROM signal_ledger ORDER BY id DESC LIMIT 1`;
const INSERT_SQL = `
  INSERT INTO signal_ledger (ticker, score, signal, price, model_version, timestamp, prev_hash, row_hash)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`;

export async function appendSignalToLedger(entry: {
  ticker: string;
  score: number;
  signal: string;
  price: number;
  timestamp: string;
}): Promise<void> {
  const lastRes = await db.execute(LAST_HASH_SQL);
  const prevHash = (lastRes.rows[0]?.row_hash as string | undefined) ?? GENESIS_HASH;
  const fields: SignalFields = { ...entry, modelVersion: MODEL_VERSION };
  const rowHash = computeRowHash(prevHash, fields);
  await db.execute({
    sql: INSERT_SQL,
    args: [entry.ticker, entry.score, entry.signal, entry.price, MODEL_VERSION, entry.timestamp, prevHash, rowHash],
  });
}

export interface LedgerVerification {
  valid: boolean;
  totalRows: number;
  brokenAtId: number | null;
}

export interface LedgerRow {
  id: number;
  ticker: string;
  score: number;
  signal: string;
  price: number;
  model_version: string;
  timestamp: string;
  prev_hash: string;
  row_hash: string;
}

// Recomputes the entire chain from genesis and compares it against what's
// stored — pure function, no I/O, so it's directly unit-testable (see
// ledger.test.ts) without a real database.
export function verifyChain(rows: LedgerRow[]): LedgerVerification {
  let expectedPrevHash = GENESIS_HASH;
  for (const r of rows) {
    if (r.prev_hash !== expectedPrevHash) {
      return { valid: false, totalRows: rows.length, brokenAtId: r.id };
    }
    const recomputed = computeRowHash(expectedPrevHash, {
      ticker: r.ticker,
      score: r.score,
      signal: r.signal,
      price: r.price,
      modelVersion: r.model_version,
      timestamp: r.timestamp,
    });
    if (recomputed !== r.row_hash) {
      return { valid: false, totalRows: rows.length, brokenAtId: r.id };
    }
    expectedPrevHash = r.row_hash;
  }

  return { valid: true, totalRows: rows.length, brokenAtId: null };
}

export async function verifyLedger(): Promise<LedgerVerification> {
  const res = await db.execute(
    `SELECT id, ticker, score, signal, price, model_version, timestamp, prev_hash, row_hash
     FROM signal_ledger ORDER BY id ASC`
  );
  return verifyChain(res.rows as unknown as LedgerRow[]);
}
