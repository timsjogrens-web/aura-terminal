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
    aux_fetched_at TEXT,
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
  `CREATE TABLE IF NOT EXISTS signal_ledger (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticker TEXT NOT NULL,
    score INTEGER NOT NULL,
    signal TEXT NOT NULL,
    price REAL NOT NULL,
    model_version TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    prev_hash TEXT NOT NULL,
    row_hash TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_signal_ledger_ticker ON signal_ledger(ticker, timestamp)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_signal_ledger_row_hash ON signal_ledger(row_hash)`,
  `CREATE TABLE IF NOT EXISTS watchlist (
    user_id INTEGER NOT NULL,
    ticker TEXT NOT NULL,
    company_name TEXT,
    sector TEXT,
    added_at TEXT NOT NULL,
    PRIMARY KEY (user_id, ticker)
  )`,
  `CREATE TABLE IF NOT EXISTS meta (
    key TEXT PRIMARY KEY,
    value TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    is_admin INTEGER NOT NULL DEFAULT 0,
    bot_enabled INTEGER NOT NULL DEFAULT 0,
    email_verified INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS auth_tokens (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    purpose TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    used_at TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS idx_auth_tokens_user ON auth_tokens(user_id, purpose)`,
  `CREATE TABLE IF NOT EXISTS rate_limits (
    key TEXT PRIMARY KEY,
    count INTEGER NOT NULL,
    window_start TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS paper_trades (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    ticker TEXT NOT NULL,
    action TEXT NOT NULL,
    shares REAL NOT NULL,
    price REAL NOT NULL,
    timestamp TEXT NOT NULL,
    reason TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS idx_paper_trades_ticker ON paper_trades(ticker, timestamp)`,
  `CREATE INDEX IF NOT EXISTS idx_paper_trades_user ON paper_trades(user_id, ticker)`,
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
    user_id INTEGER NOT NULL,
    ticker TEXT NOT NULL,
    action TEXT NOT NULL,
    shares REAL NOT NULL,
    price REAL NOT NULL,
    timestamp TEXT NOT NULL,
    reason TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS idx_manual_trades_ticker ON manual_trades(ticker, timestamp)`,
  `CREATE INDEX IF NOT EXISTS idx_manual_trades_user ON manual_trades(user_id, ticker)`,
  `CREATE TABLE IF NOT EXISTS paper_position_peaks (
    user_id INTEGER NOT NULL,
    ticker TEXT NOT NULL,
    peak_price REAL NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (user_id, ticker)
  )`,
  `CREATE TABLE IF NOT EXISTS ticker_logo_cache (
    ticker TEXT PRIMARY KEY,
    logo TEXT,
    cached_at TEXT NOT NULL
  )`,
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
