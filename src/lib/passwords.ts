import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "crypto";
import { promisify } from "util";

// Node's built-in scrypt rather than adding a dependency like bcrypt —
// no native bindings to worry about on Vercel, and scrypt is a perfectly
// standard choice for this. Stored as "salt:hash", both hex.
const scrypt = promisify(scryptCallback);
const KEY_LEN = 64;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scrypt(password, salt, KEY_LEN)) as Buffer;
  return `${salt}:${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, hashHex] = stored.split(":");
  if (!salt || !hashHex) return false;
  const derived = (await scrypt(password, salt, KEY_LEN)) as Buffer;
  const expected = Buffer.from(hashHex, "hex");
  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
}
