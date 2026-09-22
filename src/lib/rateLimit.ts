import { db } from "./db";

// Simple fixed-window rate limiter backed by the `rate_limits` table —
// no new infra (Redis etc.) for what's a handful of checks per request.
// A window is just "count of hits since window_start"; once the window
// age exceeds windowMs, the next hit resets it rather than accumulating
// forever. Good enough to blunt brute-force login guessing and mass
// signup spam without adding a dependency.
export async function checkRateLimit(
  key: string,
  maxHits: number,
  windowMs: number
): Promise<{ allowed: boolean; retryAfterSec?: number }> {
  const now = Date.now();
  const res = await db.execute({ sql: "SELECT count, window_start FROM rate_limits WHERE key = ?", args: [key] });
  const row = res.rows[0] as unknown as { count: number; window_start: string } | undefined;

  if (!row || now - new Date(row.window_start).getTime() > windowMs) {
    await db.execute({
      sql: "INSERT INTO rate_limits (key, count, window_start) VALUES (?, 1, ?) ON CONFLICT(key) DO UPDATE SET count = 1, window_start = excluded.window_start",
      args: [key, new Date(now).toISOString()],
    });
    return { allowed: true };
  }

  if (row.count >= maxHits) {
    const retryAfterSec = Math.ceil((new Date(row.window_start).getTime() + windowMs - now) / 1000);
    return { allowed: false, retryAfterSec };
  }

  await db.execute({
    sql: "UPDATE rate_limits SET count = count + 1 WHERE key = ?",
    args: [key],
  });
  return { allowed: true };
}

// Vercel sets x-forwarded-for on every request; the first entry is the
// real client IP. Falls back to a constant if it's ever missing (e.g.
// local dev without a proxy) — a shared bucket for all-unknown-IP
// traffic is still better than no limit at all.
export function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return "unknown";
}
