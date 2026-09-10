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

const pipelineUrl =
  process.env.TURSO_DATABASE_URL.replace(/^libsql:\/\//, "https://") + "/v2/pipeline";

async function execute(sql) {
  const res = await fetch(pipelineUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.TURSO_AUTH_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ requests: [{ type: "execute", stmt: { sql } }, { type: "close" }] }),
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  const json = await res.json();
  const first = json.results[0];
  if (first.type === "error") throw new Error(first.error.message);
}

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
    ticker TEXT PRIMARY KEY,
    company_name TEXT,
    sector TEXT,
    added_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS meta (
    key TEXT PRIMARY KEY,
    value TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS institutional_holdings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    manager_slug TEXT NOT NULL,
    cusip TEXT NOT NULL,
    issuer TEXT,
    ticker TEXT,
    value REAL,
    shares REAL,
    filing_date TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_inst_holdings_manager ON institutional_holdings(manager_slug, filing_date)`,
  `CREATE TABLE IF NOT EXISTS cusip_ticker_cache (
    cusip TEXT PRIMARY KEY,
    ticker TEXT
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
  `CREATE TABLE IF NOT EXISTS paper_position_peaks (
    ticker TEXT PRIMARY KEY,
    peak_price REAL NOT NULL,
    updated_at TEXT NOT NULL
  )`,
];

for (const sql of statements) {
  await execute(sql);
  console.log("OK:", sql.trim().split("\n")[0]);
}
console.log("Schema ready.");
