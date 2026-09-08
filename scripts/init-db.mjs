import { createClient } from "@libsql/client";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, "..", ".env.local");

// Minimal .env.local parser (avoids adding a dotenv dependency for a one-off script)
const envText = readFileSync(envPath, "utf8");
for (const line of envText.split("\n")) {
  const match = line.match(/^([A-Z_]+)=(.*)$/);
  if (match && !process.env[match[1]]) {
    process.env[match[1]] = match[2].replace(/^"(.*)"$/, "$1");
  }
}

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const statements = [
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

for (const sql of statements) {
  await db.execute(sql);
  console.log("OK:", sql.trim().split("\n")[0]);
}
console.log("Schema ready.");
