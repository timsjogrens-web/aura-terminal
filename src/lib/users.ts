import { db } from "./db";
import { hashPassword, verifyPassword } from "./passwords";

export interface User {
  id: number;
  email: string;
  isAdmin: boolean;
  botEnabled: boolean;
  createdAt: string;
}

interface UserRow {
  id: number;
  email: string;
  password_hash: string;
  is_admin: number;
  bot_enabled: number;
  created_at: string;
}

function toUser(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    isAdmin: row.is_admin === 1,
    botEnabled: row.bot_enabled === 1,
    createdAt: row.created_at,
  };
}

export class UserError extends Error {}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function createUser(email: string, password: string): Promise<User> {
  const normalized = email.trim().toLowerCase();
  if (!EMAIL_RE.test(normalized)) {
    throw new UserError("Ange en giltig e-postadress.");
  }
  if (password.length < 8) {
    throw new UserError("Lösenordet måste vara minst 8 tecken.");
  }

  const existing = await db.execute({ sql: "SELECT id FROM users WHERE email = ?", args: [normalized] });
  if (existing.rows.length > 0) {
    throw new UserError("Det finns redan ett konto med den e-postadressen.");
  }

  const passwordHash = await hashPassword(password);
  const createdAt = new Date().toISOString();
  const res = await db.execute({
    sql: "INSERT INTO users (email, password_hash, is_admin, bot_enabled, created_at) VALUES (?, ?, 0, 0, ?)",
    args: [normalized, passwordHash, createdAt],
  });
  const id = Number(res.lastInsertRowid);
  return { id, email: normalized, isAdmin: false, botEnabled: false, createdAt };
}

// Returns the user on success, null on a bad email/password — deliberately
// the same result for "no such account" and "wrong password" so a login
// attempt can't be used to probe which emails have signed up.
export async function verifyCredentials(email: string, password: string): Promise<User | null> {
  const normalized = email.trim().toLowerCase();
  const res = await db.execute({ sql: "SELECT * FROM users WHERE email = ?", args: [normalized] });
  const row = res.rows[0] as unknown as UserRow | undefined;
  if (!row) return null;
  const ok = await verifyPassword(password, row.password_hash);
  if (!ok) return null;
  return toUser(row);
}

export async function getUserById(id: number): Promise<User | null> {
  const res = await db.execute({ sql: "SELECT * FROM users WHERE id = ?", args: [id] });
  const row = res.rows[0] as unknown as UserRow | undefined;
  return row ? toUser(row) : null;
}

export async function setBotEnabled(userId: number, enabled: boolean): Promise<void> {
  await db.execute({
    sql: "UPDATE users SET bot_enabled = ? WHERE id = ?",
    args: [enabled ? 1 : 0, userId],
  });
}

// The "Aura Signal Engine" leaderboard entry and similar single-canonical-
// account displays anchor to the site owner's own account rather than any
// particular visitor's — this finds that account (the first admin user).
let cachedAdminId: number | null = null;
export async function getAdminUserId(): Promise<number | null> {
  if (cachedAdminId !== null) return cachedAdminId;
  const res = await db.execute("SELECT id FROM users WHERE is_admin = 1 ORDER BY id ASC LIMIT 1");
  const row = res.rows[0] as unknown as { id: number } | undefined;
  cachedAdminId = row ? row.id : null;
  return cachedAdminId;
}

// All user_ids currently opted into the auto-trading bot.
export async function getBotEnabledUserIds(): Promise<number[]> {
  const res = await db.execute("SELECT id FROM users WHERE bot_enabled = 1");
  return (res.rows as unknown as { id: number }[]).map((r) => r.id);
}
