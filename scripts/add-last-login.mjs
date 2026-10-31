// One-time migration for the live Turso DB: adds users.last_login_at, used
// by the new admin "Users" page to show who's actually logging in (not
// just who signed up). Existing users start with a NULL value — there's
// no way to know when they last logged in before this column existed, so
// the admin page shows "aldrig" for them until their next login.
//
// Usage: node scripts/add-last-login.mjs

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

async function execute(sql, args) {
  const stmt = { sql, want_rows: true };
  if (args) stmt.args = args;
  const res = await fetch(pipelineUrl, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.TURSO_AUTH_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ requests: [{ type: "execute", stmt }, { type: "close" }] }),
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  const json = await res.json();
  const first = json.results[0];
  if (first.type === "error") throw new Error(first.error.message);
  return first.response.result;
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

await addColumnIfMissing("users", "last_login_at TEXT");
console.log("Done.");
