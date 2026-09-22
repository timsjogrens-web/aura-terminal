// One-time migration for the live Turso DB, for the "pre-launch" batch of
// features: email verification, password reset tokens, rate limiting, and
// a per-account watchlist (previously one shared list).
//
// Usage: node scripts/add-launch-features.mjs

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, "..", ".env.local");

const envText = readFileSync(envPath, "utf8");
for (const line of envText.split("\n")) {
  const match = line.match(/^([A-Z_]+)=(.*)$/);
  if (match && !process.env[match[1]]) {
    process.env[match[1]] = match[2].replace(/^"(.*)"$/, "$1");
  }
}

const pipelineUrl = process.env.TURSO_DATABASE_URL.replace(/^libsql:\/\//, "https://") + "/v2/pipeline";

function enc(v) {
  if (v === null || v === undefined) return { type: "null" };
  if (typeof v === "number") return Number.isInteger(v) ? { type: "integer", value: String(v) } : { type: "float", value: v };
  return { type: "text", value: String(v) };
}

async function execute(sql, args) {
  const stmt = { sql, want_rows: true };
  if (args) stmt.args = args.map(enc);
  const res = await fetch(pipelineUrl, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.TURSO_AUTH_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ requests: [{ type: "execute", stmt }, { type: "close" }] }),
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  const json = await res.json();
  const first = json.results[0];
  if (first.type === "error") throw new Error(first.error.message);
  const result = first.response.result;
  const cols = result.cols.map((c) => c.name);
  return result.rows.map((row) => {
    const obj = {};
    row.forEach((cell, i) => (obj[cols[i]] = cell.value ?? null));
    return obj;
  });
}

async function addColumnIfMissing(table, columnDef) {
  const columnName = columnDef.split(" ")[0];
  try {
    await execute(`ALTER TABLE ${table} ADD COLUMN ${columnDef}`);
    console.log(`Added ${columnName} to ${table}.`);
  } catch (e) {
    if (String(e.message).includes("duplicate column")) {
      console.log(`${table}.${columnName} already exists, skipping.`);
    } else {
      throw e;
    }
  }
}

async function main() {
  // 1. email_verified on users — grandfather in every existing account
  // (they were already trusted enough to be using the site before this
  // feature existed); only NEW signups from now on start unverified.
  await addColumnIfMissing("users", "email_verified INTEGER NOT NULL DEFAULT 0");
  await execute("UPDATE users SET email_verified = 1 WHERE email_verified = 0");
  console.log("Grandfathered existing users as email_verified.");

  // 2. auth_tokens (password reset + email verification)
  await execute(`CREATE TABLE IF NOT EXISTS auth_tokens (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    purpose TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    used_at TEXT
  )`);
  await execute("CREATE INDEX IF NOT EXISTS idx_auth_tokens_user ON auth_tokens(user_id, purpose)");
  console.log("auth_tokens table ready.");

  // 3. rate_limits
  await execute(`CREATE TABLE IF NOT EXISTS rate_limits (
    key TEXT PRIMARY KEY,
    count INTEGER NOT NULL,
    window_start TEXT NOT NULL
  )`);
  console.log("rate_limits table ready.");

  // 4. watchlist: rebuild with a composite (user_id, ticker) key — SQLite
  // can't alter a primary key in place. Existing rows (the one shared
  // list) all get attached to the admin account, so nothing is lost —
  // Tim's own watchlist just becomes personal instead of global.
  const watchlistCols = await execute("PRAGMA table_info(watchlist)");
  const alreadyMigrated = watchlistCols.some((r) => r.name === "user_id");
  if (!alreadyMigrated) {
    const admin = await execute("SELECT id FROM users WHERE is_admin = 1 ORDER BY id ASC LIMIT 1");
    const adminId = admin[0]?.id;
    if (!adminId) throw new Error("No admin user found — run the multi-user-accounts migration first.");

    await execute("ALTER TABLE watchlist RENAME TO watchlist_old");
    await execute(`CREATE TABLE watchlist (
      user_id INTEGER NOT NULL,
      ticker TEXT NOT NULL,
      company_name TEXT,
      sector TEXT,
      added_at TEXT NOT NULL,
      PRIMARY KEY (user_id, ticker)
    )`);
    const oldRows = await execute("SELECT ticker, company_name, sector, added_at FROM watchlist_old");
    for (const row of oldRows) {
      await execute(
        "INSERT INTO watchlist (user_id, ticker, company_name, sector, added_at) VALUES (?, ?, ?, ?, ?)",
        [adminId, row.ticker, row.company_name, row.sector, row.added_at]
      );
    }
    await execute("DROP TABLE watchlist_old");
    console.log(`Migrated watchlist to per-account (${oldRows.length} row(s) attached to admin id ${adminId}).`);
  } else {
    console.log("watchlist already migrated, skipping.");
  }

  console.log("\nDone.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
