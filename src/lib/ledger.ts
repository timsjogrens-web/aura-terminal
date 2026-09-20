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
// Concurrency: appending is a compare-and-swap in a single SQL statement
// (the insert only happens if the row we're chaining onto is still the
// latest one), retried if another writer got in first. An earlier version
// read the latest hash and inserted in two steps, which let two overlapping
// refresh runs both chain onto the same row — see KNOWN_FORKS below.

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

// Inserts only if the latest row's hash is still the one we chained onto
// (or the ledger is empty and we chained onto genesis). SQLite runs the
// subselect and the insert as one statement, so two concurrent writers can't
// both succeed with the same predecessor.
const CAS_INSERT_SQL = `
  INSERT INTO signal_ledger (ticker, score, signal, price, model_version, timestamp, prev_hash, row_hash)
  SELECT ?, ?, ?, ?, ?, ?, ?, ?
  WHERE COALESCE((SELECT row_hash FROM signal_ledger ORDER BY id DESC LIMIT 1), ?) = ?
`;

const MAX_APPEND_ATTEMPTS = 6;

export async function appendSignalToLedger(entry: {
  ticker: string;
  score: number;
  signal: string;
  price: number;
  timestamp: string;
}): Promise<void> {
  const fields: SignalFields = { ...entry, modelVersion: MODEL_VERSION };
  for (let attempt = 0; attempt < MAX_APPEND_ATTEMPTS; attempt++) {
    const lastRes = await db.execute(LAST_HASH_SQL);
    const prevHash = (lastRes.rows[0]?.row_hash as string | undefined) ?? GENESIS_HASH;
    const rowHash = computeRowHash(prevHash, fields);
    await db.execute({
      sql: CAS_INSERT_SQL,
      args: [
        entry.ticker,
        entry.score,
        entry.signal,
        entry.price,
        MODEL_VERSION,
        entry.timestamp,
        prevHash,
        rowHash,
        GENESIS_HASH,
        prevHash,
      ],
    });
    const stored = await db.execute({ sql: "SELECT 1 FROM signal_ledger WHERE row_hash = ?", args: [rowHash] });
    if (stored.rows.length > 0) return;
  }
  throw new Error("Could not append to the signal ledger: another writer kept getting in first.");
}

export interface LedgerVerification {
  valid: boolean;
  totalRows: number;
  brokenAtId: number | null;
  acceptedForks: number;
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

// Rows written by two refresh runs overlapping in time, back when appending
// was a non-atomic read-then-insert: both chained onto the same predecessor,
// so one of the pair is a "dead end" that no later row builds on. That is a
// concurrency artefact, not tampering — every one of these rows still hashes
// correctly against its own contents — but it breaks a strictly linear
// chain, so they're listed here explicitly rather than the verifier being
// loosened in general. Each entry pins the dead-end row's hash, so editing or
// deleting one of them is still detected. The ledger itself is never
// rewritten. Found and listed on 2026-09-20; no new forks can occur now that
// appends are atomic (see appendSignalToLedger).
export interface KnownFork {
  deadEndId: number;
  deadEndHash: string;
}
export const KNOWN_FORKS: KnownFork[] = [
  { deadEndId: 52, deadEndHash: "c67c788defb11e987fff34b9d2ac591af297ff3fc0f32ba55038377e7086e892" }, // CRM 2026-09-11T14:06Z
  { deadEndId: 472, deadEndHash: "f5d29490d63c8ee57aeaa91fce9bc4fcfb3fcdc0713884b6ae59d64f396124d4" }, // ANET 2026-09-18T15:05Z
  { deadEndId: 547, deadEndHash: "03ca52c34054353a51d9ea0a057053c55a691982899ac923ab8fe0406a7c2ca3" }, // PANW 2026-09-20T20:48Z
  { deadEndId: 549, deadEndHash: "615b52c6d1ca5ba81369da9c65a11db5f8fa188332a74a4d140e172f3db2f01c" }, // QCOM 2026-09-20T20:48Z
  { deadEndId: 554, deadEndHash: "afbc3244f7732dfee1e0529bd8bbccf33888885d701a496fd3c08854ff82ceaf" }, // TXN 2026-09-20T20:48Z
  { deadEndId: 556, deadEndHash: "c9651c469d12e698883c040f803a341774d912bbd91c2d0233a66d8bb42e44cd" }, // VRSN 2026-09-20T20:48Z
  { deadEndId: 558, deadEndHash: "0a70dfe5b48379844913a12a3ae7c267141258ff32f12a175a966c152797474b" }, // ALLY 2026-09-20T20:48Z
  { deadEndId: 560, deadEndHash: "f5fea69e46736c57b55d6e1fb2cb3f365a07e8150a11963dc65bb760df74c11f" }, // APO 2026-09-20T20:48Z
  { deadEndId: 562, deadEndHash: "701fb912b99390bb55cb9e5b5565d2284bd8fa85394ceaf874f9a7060915c11e" }, // AXP 2026-09-20T20:48Z
  { deadEndId: 567, deadEndHash: "a5393f9bfe5a0c26ce8db1953b9abb3e41ce3ebe35898fefb2110cccd979e907" }, // CPAY 2026-09-20T20:49Z
  { deadEndId: 569, deadEndHash: "4d25a89f19b6e6972fe3521a95890898cfaed064b079fa262c079126d36d3d58" }, // EWBC 2026-09-20T20:49Z
  { deadEndId: 571, deadEndHash: "f5fc288937dfb4c9584226313af8ff375ff365bfa4f533cbab9321cdcc3937f7" }, // MCO 2026-09-20T20:49Z
  { deadEndId: 573, deadEndHash: "2adfee2787132eddd32ae43403432110be734051bf98f342abeb0797cb93ccc8" }, // MSCI 2026-09-20T20:49Z
  { deadEndId: 575, deadEndHash: "07e732a07112d877b1e7644deb37dd036c63595363a4e8d1a52766f89de6b175" }, // PS 2026-09-20T20:49Z
  { deadEndId: 581, deadEndHash: "9c5666a74fcbd85855b3f1d5520cd53f3ce9a4d28b8433224237b3959f5c5287" }, // XYZ 2026-09-20T20:49Z
  { deadEndId: 589, deadEndHash: "46c671ef7c66ab692d0d4436d2445fc1ef14bf978306673817ef9ccc16078758" }, // NTRA 2026-09-20T20:50Z
];

// Recomputes the entire chain from genesis and compares it against what's
// stored — pure function, no I/O, so it's directly unit-testable (see
// ledger.test.ts) without a real database.
export function verifyChain(rows: LedgerRow[], knownForks: KnownFork[] = KNOWN_FORKS): LedgerVerification {
  const pinned = new Map(knownForks.map((f) => [f.deadEndId, f.deadEndHash]));
  const invalid = (id: number): LedgerVerification => ({
    valid: false,
    totalRows: rows.length,
    brokenAtId: id,
    acceptedForks: 0,
  });

  let tip = GENESIS_HASH;
  let acceptedForks = 0;
  const seenIds = new Set<number>();

  for (const r of rows) {
    seenIds.add(r.id);
    const recomputed = computeRowHash(r.prev_hash, {
      ticker: r.ticker,
      score: r.score,
      signal: r.signal,
      price: r.price,
      modelVersion: r.model_version,
      timestamp: r.timestamp,
    });
    if (recomputed !== r.row_hash) return invalid(r.id);

    if (pinned.has(r.id)) {
      // A known dead end: forked from the current tip, never built upon.
      if (r.row_hash !== pinned.get(r.id) || r.prev_hash !== tip) return invalid(r.id);
      acceptedForks++;
      continue;
    }

    if (r.prev_hash !== tip) return invalid(r.id);
    tip = r.row_hash;
  }

  // A pinned dead end that has vanished is a deletion, even though the rows
  // around it still link up.
  for (const f of knownForks) {
    if (!seenIds.has(f.deadEndId)) return invalid(f.deadEndId);
  }

  return { valid: true, totalRows: rows.length, brokenAtId: null, acceptedForks };
}

export async function verifyLedger(): Promise<LedgerVerification> {
  const res = await db.execute(
    `SELECT id, ticker, score, signal, price, model_version, timestamp, prev_hash, row_hash
     FROM signal_ledger ORDER BY id ASC`
  );
  return verifyChain(res.rows as unknown as LedgerRow[]);
}
