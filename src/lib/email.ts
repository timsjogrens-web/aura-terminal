// Transactional email via Resend's plain HTTP API — same philosophy as
// finnhub.ts/turso.ts: a couple of fetch calls, no SDK dependency.
// Requires RESEND_API_KEY. Until Tim sets that up, this silently no-ops
// (logs instead of throwing) so password reset / verification requests
// don't 500 — the caller already returns a generic "if that email has an
// account, check it" response either way, so a silently-skipped send is
// indistinguishable from a real one to anyone probing for which emails exist.

export class EmailError extends Error {}

// Resend's own shared sending domain — works immediately with no DNS
// setup, fine for this volume. Swap for a verified custom domain later
// if wanted (cosmetic only: from-address, not deliverability at this scale).
const FROM_ADDRESS = "TS Terminal <onboarding@resend.dev>";

export async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn(`RESEND_API_KEY not configured — skipping email to ${to}: "${subject}"`);
    return;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: FROM_ADDRESS, to, subject, html }),
  });

  if (!res.ok) {
    // Best-effort: log but don't fail the caller's request over a
    // deliverability hiccup — the user can always retry ("skicka igen").
    console.error(`Resend send failed: ${res.status} ${await res.text()}`);
  }
}

function emailShell(bodyHtml: string): string {
  return `
    <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; color: #1a1a1a;">
      <div style="font-weight: 800; font-size: 18px; margin-bottom: 24px;">
        <span style="color: #f5a524;">TS</span> TERMINAL
      </div>
      ${bodyHtml}
      <p style="margin-top: 32px; font-size: 12px; color: #888;">
        TS Terminal &mdash; ett personligt projekt, inte finansiell rådgivning.
      </p>
    </div>
  `;
}

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  await sendEmail(
    to,
    "Återställ ditt lösenord — TS Terminal",
    emailShell(`
      <p>Någon (troligen du) bad om att återställa lösenordet för det här kontot.</p>
      <p><a href="${resetUrl}" style="display: inline-block; background: #f5a524; color: #000; font-weight: 700; padding: 10px 20px; border-radius: 6px; text-decoration: none;">Välj nytt lösenord</a></p>
      <p style="font-size: 13px; color: #666;">Länken slutar fungera om 1 timme. Bad du inte om detta? Ignorera bara mejlet — inget ändras förrän du klickar på länken.</p>
    `)
  );
}

export async function sendVerificationEmail(to: string, verifyUrl: string): Promise<void> {
  await sendEmail(
    to,
    "Bekräfta din e-post — TS Terminal",
    emailShell(`
      <p>Bekräfta din e-postadress för att slutföra registreringen:</p>
      <p><a href="${verifyUrl}" style="display: inline-block; background: #f5a524; color: #000; font-weight: 700; padding: 10px 20px; border-radius: 6px; text-decoration: none;">Bekräfta e-post</a></p>
      <p style="font-size: 13px; color: #666;">Länken slutar fungera om 24 timmar.</p>
    `)
  );
}
