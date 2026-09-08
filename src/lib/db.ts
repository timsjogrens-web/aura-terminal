import { createClient, type Client } from "@libsql/client";

// Lazily created so a missing env var only breaks an actual DB call at
// request time, not module load — Next's build-time route collection
// imports this file without ever calling anything on `db`.
let client: Client | null = null;

function getClient(): Client {
  if (client) return client;
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url || !authToken) {
    throw new Error(
      "TURSO_DATABASE_URL and TURSO_AUTH_TOKEN must be set in .env.local (or your host's env vars)."
    );
  }
  client = createClient({ url, authToken });
  return client;
}

export const db: Client = new Proxy({} as Client, {
  get(_target, prop, _receiver) {
    const real = getClient();
    const value = Reflect.get(real, prop, real);
    return typeof value === "function" ? value.bind(real) : value;
  },
});

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
