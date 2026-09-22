// One-time migration for the live Turso DB: adds real per-user accounts
// (users table), tags the existing paper/manual trade logs with a user_id,
// and recreates paper_position_peaks with a composite (user_id, ticker)
// key instead of ticker alone (multiple users can now hold the same
// ticker at once). Every existing trade/position/cash-balance row gets
// attached to Tim's own new admin account, so his real history is kept
// exactly as-is; every OTHER user who signs up after this starts from a
// clean $100,000 (see portfolio.ts's lazy-default behavior — no explicit
// row needs creating for them).
//
// Usage:
//   ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='...' node scripts/add-multi-user-accounts.mjs
//
// The email/password are read from the environment only — never written
// to this file — so the real password never ends up in git history.

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";
import { randomBytes, scrypt as scryptCallback } from "crypto";
import { promisify } from "util";

const scrypt = promisify(scryptCallback);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, "..", ".env.local");

const envText = readFileSync(envPath, "utf8");
for (const line of envText.split("\n")) {
  const match = line.match(/^([A-Z_]+)=(.*)$/);
  if (match && !process.env[match[1]]) {
    process.env[match[1]] = match[2].replace(/^"(.*)"$/, "$1");
  }
}

const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error(
    "Usage: ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='...' node scripts/add-multi-user-accounts.mjs"
  );
  process.exit(1);
}
if (ADMIN_PASSWORD.length < 8) {
  console.error("ADMIN_PASSWORD must be at least 8 characters.");
  process.exit(1);
}

const pipelineUrl =
  process.env.TURSO_DATABASE_URL.replace(/^libsql:\/\//, "https://") + "/v2/pipeline";

function encodeValue(v) {
  if (v === null || v === undefined) return { type: "null" };
  if (typeof v === "number") return Number.isInteger(v) ? { type: "integer", value: String(v) } : { type: "float", value: v };
  return { type: "text", value: String(v) };
}

function decodeValue(v) {
  if (v.type === "null") return null;
  if (v.type === "integer") return Number(v.value);
  if (v.type === "float") return Number(v.value);
  if (v.type === "text") return String(v.value ?? "");
  return null;
}

async function execute(sql, args) {
  const stmt = { sql, want_rows: true };
  if (args) stmt.args = args.map(encodeValue);
  const res = await fetch(pipelineUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.TURSO_AUTH_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ requests: [{ type: "execute", stmt }, { type: "close" }] }),
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  const json = await res.json();
  const first = json.results[0];
  if (first.type === "error") throw new Error(first.error.message);
  const result = first.response.result;
  const cols = result.cols.map((c) => c.name);
  const rows = result.rows.map((row) => {
    const obj = {};
    row.forEach((cell, i) => (obj[cols[i]] = decodeValue(cell)));
    return obj;
  });
  return { rows, lastInsertRowid: result.last_insert_rowid ? Number(result.last_insert_rowid) : null };
}

async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const derived = await scrypt(password, salt, 64);
  return `${salt}:${derived.toString("hex")}`;
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

async function renameMetaKey(oldKey, newKey) {
  const res = await execute("SELECT value FROM meta WHERE key = ?", [oldKey]);
  if (res.rows.length === 0) return;
  const value = res.rows[0].value;
  await execute("INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", [
    newKey,
    value,
  ]);
  await execute("DELETE FROM meta WHERE key = ?", [oldKey]);
  console.log(`Migrated meta key ${oldKey} -> ${newKey}.`);
}

async function main() {
  await execute(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    is_admin INTEGER NOT NULL DEFAULT 0,
    bot_enabled INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  )`);
  console.log("users table ready.");

  await addColumnIfMissing("paper_trades", "user_id INTEGER");
  await addColumnIfMissing("manual_trades", "user_id INTEGER");

  // paper_position_peaks: rebuild with a composite (user_id, ticker) key —
  // SQLite can't ALTER a table's primary key in place.
  const peaksCols = await execute("PRAGMA table_info(paper_position_peaks)");
  const alreadyMigrated = peaksCols.rows.some((r) => r.name === "user_id");
  if (!alreadyMigrated) {
    await execute("ALTER TABLE paper_position_peaks RENAME TO paper_position_peaks_old");
    await execute(`CREATE TABLE paper_position_peaks (
      user_id INTEGER NOT NULL,
      ticker TEXT NOT NULL,
      peak_price REAL NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (user_id, ticker)
    )`);
    console.log("Recreated paper_position_peaks with a composite key (rows re-inserted below, after we know the admin's user id).");
  } else {
    console.log("paper_position_peaks already migrated, skipping rebuild.");
  }

  // Create (or reuse) the admin account and attach all pre-existing data to it.
  const existing = await execute("SELECT id FROM users WHERE email = ?", [ADMIN_EMAIL.trim().toLowerCase()]);
  let adminId;
  if (existing.rows.length > 0) {
    adminId = existing.rows[0].id;
    console.log(`Admin user already exists (id ${adminId}), reusing it.`);
  } else {
    const passwordHash = await hashPassword(ADMIN_PASSWORD);
    const res = await execute(
      "INSERT INTO users (email, password_hash, is_admin, bot_enabled, created_at) VALUES (?, ?, 1, 0, ?)",
      [ADMIN_EMAIL.trim().toLowerCase(), passwordHash, new Date().toISOString()]
    );
    adminId = res.lastInsertRowid;
    console.log(`Created admin user ${ADMIN_EMAIL} (id ${adminId}).`);
  }

  await execute("UPDATE paper_trades SET user_id = ? WHERE user_id IS NULL", [adminId]);
  await execute("UPDATE manual_trades SET user_id = ? WHERE user_id IS NULL", [adminId]);
  console.log("Backfilled existing paper_trades/manual_trades rows to the admin account.");

  if (!alreadyMigrated) {
    const oldPeaks = await execute("SELECT ticker, peak_price, updated_at FROM paper_position_peaks_old");
    for (const row of oldPeaks.rows) {
      await execute(
        "INSERT INTO paper_position_peaks (user_id, ticker, peak_price, updated_at) VALUES (?, ?, ?, ?)",
        [adminId, row.ticker, row.peak_price, row.updated_at]
      );
    }
    await execute("DROP TABLE paper_position_peaks_old");
    console.log(`Re-inserted ${oldPeaks.rows.length} paper_position_peaks row(s) under the admin account.`);
  }

  await renameMetaKey("paper_cash", `paper_cash:${adminId}`);
  await renameMetaKey("paper_started_at", `paper_started_at:${adminId}`);
  await renameMetaKey("manual_cash", `manual_cash:${adminId}`);
  await renameMetaKey("manual_started_at", `manual_started_at:${adminId}`);

  console.log("\nDone. Admin user id:", adminId);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
