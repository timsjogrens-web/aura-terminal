// Real, always-on alerts — unlike the browser Notification API (which only
// fires while a tab is open), this posts from the server-side refresh job
// itself, so it reaches you whether or not the app is open. Entirely
// opt-in and free: DISCORD_WEBHOOK_URL is a webhook the user creates in
// their own Discord server (Server Settings -> Integrations -> Webhooks),
// no account or credentials created on their behalf. No-ops if unset.

export async function sendStrongBuyAlert(ticker: string, price: number, score: number): Promise<void> {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) return;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://candorapp.se";

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        embeds: [
          {
            title: `${ticker} just hit STRONG BUY`,
            description: `Score ${score} at $${price.toFixed(2)}`,
            url: `${appUrl}/stock/${ticker}`,
            color: 0x6fb0e0,
            footer: { text: "Candor · Not financial advice" },
          },
        ],
      }),
    });
  } catch {
    // Alerts are best-effort — a failed webhook post shouldn't break the refresh cycle.
  }
}
