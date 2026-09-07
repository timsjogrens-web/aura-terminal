import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const DATA_DIR = path.join(process.cwd(), "data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = path.join(DATA_DIR, "aura.db");

declare global {
  // eslint-disable-next-line no-var
  var __auraDb: Database.Database | undefined;
}

function createDb(): Database.Database {
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS quote_cache (
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
    );

    CREATE TABLE IF NOT EXISTS signal_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticker TEXT NOT NULL,
      score INTEGER,
      signal TEXT,
      price REAL,
      timestamp TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_signal_history_ticker ON signal_history(ticker, timestamp);

    CREATE TABLE IF NOT EXISTS watchlist (
      ticker TEXT PRIMARY KEY,
      company_name TEXT,
      sector TEXT,
      added_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);

  const existingColumns = db
    .prepare("PRAGMA table_info(quote_cache)")
    .all() as { name: string }[];
  if (!existingColumns.some((c) => c.name === "news")) {
    db.exec("ALTER TABLE quote_cache ADD COLUMN news TEXT");
  }

  return db;
}

export const db = globalThis.__auraDb ?? createDb();
if (process.env.NODE_ENV !== "production") globalThis.__auraDb = db;

export function getMeta(key: string): string | null {
  const row = db.prepare("SELECT value FROM meta WHERE key = ?").get(key) as
    | { value: string }
    | undefined;
  return row?.value ?? null;
}

export function setMeta(key: string, value: string) {
  db.prepare(
    "INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  ).run(key, value);
}
