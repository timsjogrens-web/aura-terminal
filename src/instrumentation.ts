export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  // On Vercel (or any host that sets VERCEL), scheduled refresh runs via
  // Vercel Cron hitting /api/refresh instead — node-cron needs a long-lived
  // process, which serverless functions aren't. Local `npm run dev` (and any
  // other persistent-process host) keeps using node-cron here.
  if (process.env.VERCEL) return;

  const cron = await import("node-cron");
  const { refreshAll } = await import("@/lib/refresh");

  if (!process.env.FINNHUB_API_KEY) {
    console.warn(
      "[aura] FINNHUB_API_KEY is not set — skipping scheduled data refresh until it's configured."
    );
    return;
  }

  // Refresh once shortly after boot, then every 15 minutes.
  setTimeout(() => {
    refreshAll().catch((e) => console.error("[aura] initial refresh failed:", e));
  }, 3000);

  cron.schedule("*/15 * * * *", () => {
    refreshAll().catch((e) => console.error("[aura] scheduled refresh failed:", e));
  });

  console.log("[aura] scheduled data refresh every 15 minutes");
}
