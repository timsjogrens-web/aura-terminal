import { randomBytes } from "crypto";
import { db } from "./db";
import { hashPassword, verifyPassword } from "./passwords";

export interface User {
  id: number;
  email: string;
  isAdmin: boolean;
  botEnabled: boolean;
  emailVerified: boolean;
  createdAt: string;
}

interface UserRow {
  id: number;
  email: string;
  password_hash: string;
  is_admin: number;
  bot_enabled: number;
  email_verified: number;
  created_at: string;
}

function toUser(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    isAdmin: row.is_admin === 1,
    botEnabled: row.bot_enabled === 1,
    emailVerified: row.email_verified === 1,
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
    sql: "INSERT INTO users (email, password_hash, is_admin, bot_enabled, email_verified, created_at) VALUES (?, ?, 0, 0, 0, ?)",
    args: [normalized, passwordHash, createdAt],
  });
  const id = Number(res.lastInsertRowid);
  return { id, email: normalized, isAdmin: false, botEnabled: false, emailVerified: false, createdAt };
}

// Signing in with Google: reuses the account if this (Google-verified)
// email already has one — whether it was created by password signup or a
// previous Google sign-in — otherwise creates a new one. The stored
// password_hash is random and never handed out, which simply means
// password login never succeeds for a Google-only account; there's no
// separate "how did this account get created" flag to track. Google has
// already verified the email itself, so these start email_verified.
export async function findOrCreateGoogleUser(email: string): Promise<{ user: User; isNew: boolean }> {
  const normalized = email.trim().toLowerCase();
  const existing = await db.execute({ sql: "SELECT * FROM users WHERE email = ?", args: [normalized] });
  const row = existing.rows[0] as unknown as UserRow | undefined;
  if (row) return { user: toUser(row), isNew: false };

  const passwordHash = await hashPassword(randomBytes(32).toString("hex"));
  const createdAt = new Date().toISOString();
  const res = await db.execute({
    sql: "INSERT INTO users (email, password_hash, is_admin, bot_enabled, email_verified, created_at) VALUES (?, ?, 0, 0, 1, ?)",
    args: [normalized, passwordHash, createdAt],
  });
  const id = Number(res.lastInsertRowid);
  return {
    user: { id, email: normalized, isAdmin: false, botEnabled: false, emailVerified: true, createdAt },
    isNew: true,
  };
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

export async function getUserByEmail(email: string): Promise<User | null> {
  const res = await db.execute({ sql: "SELECT * FROM users WHERE email = ?", args: [email.trim().toLowerCase()] });
  const row = res.rows[0] as unknown as UserRow | undefined;
  return row ? toUser(row) : null;
}

export async function setBotEnabled(userId: number, enabled: boolean): Promise<void> {
  await db.execute({
    sql: "UPDATE users SET bot_enabled = ? WHERE id = ?",
    args: [enabled ? 1 : 0, userId],
  });
}

export async function setEmailVerified(userId: number): Promise<void> {
  await db.execute({ sql: "UPDATE users SET email_verified = 1 WHERE id = ?", args: [userId] });
}

export async function setPassword(userId: number, password: string): Promise<void> {
  if (password.length < 8) {
    throw new UserError("Lösenordet måste vara minst 8 tecken.");
  }
  const passwordHash = await hashPassword(password);
  await db.execute({ sql: "UPDATE users SET password_hash = ? WHERE id = ?", args: [passwordHash, userId] });
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

// --- Password reset / email verification tokens -----------------------
// One shared table for both purposes (see db.ts's auth_tokens) — a
// single-use, expiring, random token tied to a user and a purpose.
// Never reveals whether an email exists (callers always return the same
// generic success message regardless of whether a matching user or a
// pending token was actually found), so this can't be used to probe
// which emails have accounts.

export type TokenPurpose = "reset" | "verify";

const RESET_TTL_MS = 60 * 60 * 1000; // 1 hour
const VERIFY_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export async function createAuthToken(userId: number, purpose: TokenPurpose): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const ttl = purpose === "reset" ? RESET_TTL_MS : VERIFY_TTL_MS;
  const expiresAt = new Date(Date.now() + ttl).toISOString();
  await db.execute({
    sql: "INSERT INTO auth_tokens (token, user_id, purpose, expires_at, used_at) VALUES (?, ?, ?, ?, NULL)",
    args: [token, userId, purpose, expiresAt],
  });
  return token;
}

// Looks up a token for the given purpose; returns the user_id if it's
// valid (exists, right purpose, not expired, not already used) or null.
// Does NOT mark it used — call consumeAuthToken once the token's action
// has actually been carried out (so a failed password update, say,
// doesn't burn the token).
export async function peekAuthToken(token: string, purpose: TokenPurpose): Promise<number | null> {
  const res = await db.execute({
    sql: "SELECT user_id, purpose, expires_at, used_at FROM auth_tokens WHERE token = ?",
    args: [token],
  });
  const row = res.rows[0] as unknown as
    | { user_id: number; purpose: string; expires_at: string; used_at: string | null }
    | undefined;
  if (!row || row.purpose !== purpose || row.used_at) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) return null;
  return row.user_id;
}

export async function consumeAuthToken(token: string): Promise<void> {
  await db.execute({
    sql: "UPDATE auth_tokens SET used_at = ? WHERE token = ?",
    args: [new Date().toISOString(), token],
  });
}
