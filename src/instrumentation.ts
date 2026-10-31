export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  // On Vercel (or any host that sets VERCEL), scheduled refresh runs via
  // Vercel Cron hitting /api/refresh instead — node-cron needs a long-lived
  // process, which serverless functions aren't. Local `npm run dev` (and any
  // other persistent-process host) keeps using node-cron here.
  if (process.env.VERCEL) return;

  // Local dev talks to the SAME live database as production (same
  // TURSO_DATABASE_URL in .env.local) — there's no separate dev database.
  // This cron doesn't just refresh prices, it also drives the live
  // paper-trading bot (refreshAll -> maybeTrade/checkRiskExits), so an
  // always-on 15-minute loop here means every local dev session silently
  // trades the real paper account far more often than the actual once-a-day
  // production cadence (vercel.json), which skews its real track record.
  // Off by default; set ENABLE_LOCAL_REFRESH_CRON=true to opt in when you
  // deliberately want live cycling while developing.
  if (process.env.ENABLE_LOCAL_REFRESH_CRON !== "true") {
    console.log(
      "[candor] local scheduled refresh disabled (would trade the live paper account) — set ENABLE_LOCAL_REFRESH_CRON=true to enable"
    );
    return;
  }

  const cron = await import("node-cron");
  const { refreshAll } = await import("@/lib/refresh");

  if (!process.env.FINNHUB_API_KEY) {
    console.warn(
      "[candor] FINNHUB_API_KEY is not set — skipping scheduled data refresh until it's configured."
    );
    return;
  }

  // Refresh once shortly after boot, then every 15 minutes.
  setTimeout(() => {
    refreshAll().catch((e) => console.error("[candor] initial refresh failed:", e));
  }, 3000);

  cron.schedule("*/15 * * * *", () => {
    refreshAll().catch((e) => console.error("[candor] scheduled refresh failed:", e));
  });

  console.log("[candor] scheduled data refresh every 15 minutes");
}
