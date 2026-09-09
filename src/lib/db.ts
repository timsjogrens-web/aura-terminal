import { createTursoClient, type TursoClient } from "./turso";

// Lazily created so a missing env var only breaks an actual DB call at
// request time, not module load — Next's build-time route collection
// imports this file without ever calling anything on `db`.
let client: TursoClient | null = null;

function getClient(): TursoClient {
  if (client) return client;
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url || !authToken) {
    throw new Error(
      "TURSO_DATABASE_URL and TURSO_AUTH_TOKEN must be set in .env.local (or your host's env vars)."
    );
  }
  client = createTursoClient(url, authToken);
  return client;
}

export const db: TursoClient = {
  execute: (query) => getClient().execute(query),
};

export const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS quote_cache (
    ticker TEXT PRIMARY KEY,
    company_name TEXT,
    sector TEXT,
    price REAL,
    change REAL,
    change_pct REAL,
    open REAL,
    high REAL,
    low REAL,
    prev_close REAL,
    volume REAL,
    avg_volume REAL,
    sma50 REAL,
    rsi14 REAL,
    score INTEGER,
    signal TEXT,
    sparkline TEXT,
    next_earnings TEXT,
    news TEXT,
    logo TEXT,
    updated_at TEXT,
    error TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS signal_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticker TEXT NOT NULL,
    score INTEGER,
    signal TEXT,
    price REAL,
    timestamp TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_signal_history_ticker ON signal_history(ticker, timestamp)`,
  `CREATE TABLE IF NOT EXISTS watchlist (
    ticker TEXT PRIMARY KEY,
    company_name TEXT,
    sector TEXT,
    added_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS meta (
    key TEXT PRIMARY KEY,
    value TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS paper_trades (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticker TEXT NOT NULL,
    action TEXT NOT NULL,
    shares REAL NOT NULL,
    price REAL NOT NULL,
    timestamp TEXT NOT NULL,
    reason TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS idx_paper_trades_ticker ON paper_trades(ticker, timestamp)`,
  `CREATE TABLE IF NOT EXISTS insider_trades (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticker TEXT NOT NULL,
    owner_name TEXT NOT NULL,
    owner_title TEXT,
    transaction_code TEXT NOT NULL,
    shares REAL NOT NULL,
    price REAL NOT NULL,
    value REAL NOT NULL,
    transaction_date TEXT NOT NULL,
    filing_date TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_insider_trades_ticker ON insider_trades(ticker, transaction_date)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_insider_trades_dedup ON insider_trades(ticker, owner_name, transaction_date, shares, price)`,
  `CREATE TABLE IF NOT EXISTS manual_trades (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticker TEXT NOT NULL,
    action TEXT NOT NULL,
    shares REAL NOT NULL,
    price REAL NOT NULL,
    timestamp TEXT NOT NULL,
    reason TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS idx_manual_trades_ticker ON manual_trades(ticker, timestamp)`,
];

export async function getMeta(key: string): Promise<string | null> {
  const res = await db.execute({ sql: "SELECT value FROM meta WHERE key = ?", args: [key] });
  const row = res.rows[0];
  return row ? (row.value as string) : null;
}

export async function setMeta(key: string, value: string): Promise<void> {
  await db.execute({
    sql: "INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    args: [key, value],
  });
}
