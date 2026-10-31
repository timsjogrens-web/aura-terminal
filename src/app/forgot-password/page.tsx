"use client";

import { useState } from "react";
import Link from "next/link";
import { LogoMark, Wordmark } from "@/components/Logo";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
    } finally {
      // Always show the same success state, whether or not the email
      // actually has an account — see the API route for why.
      setSent(true);
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-[var(--background)] px-4">
      <div aria-hidden="true" className="absolute inset-0 space-bg-strong" />
      <div aria-hidden="true" className="space-twinkle" />

      <div className="relative z-10 w-full max-w-sm rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] p-8 shadow-2xl">
        <div className="flex items-center gap-3 mb-8">
          <LogoMark size={36} />
          <Wordmark className="text-lg" />
        </div>

        {sent ? (
          <>
            <h1 className="font-serif text-2xl text-[var(--text-primary)] mb-3">Kolla din inkorg</h1>
            <p className="text-sm text-[var(--text-secondary)]">
              Om {email} har ett konto hos oss har vi skickat en länk för att välja ett nytt
              lösenord. Länken slutar fungera om 1 timme.
            </p>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <h1 className="font-serif text-2xl text-[var(--text-primary)] mb-1">Glömt lösenord</h1>
            <p className="text-sm text-[var(--text-secondary)] mb-6">
              Ange din e-post och vi skickar en länk för att välja ett nytt lösenord.
            </p>

            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
              E-post
            </label>
            <input
              type="email"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-[var(--surface-border)] bg-black/40 px-3 py-2.5 font-mono text-[var(--text-primary)] outline-none focus:border-[var(--accent)] transition-colors"
              placeholder="du@exempel.se"
            />

            <button
              type="submit"
              disabled={loading || !email}
              className="mt-6 w-full rounded-md bg-[var(--accent)] py-2.5 font-sans font-bold text-black tracking-wide hover:brightness-110 transition disabled:opacity-50"
            >
              {loading ? "Skickar..." : "Skicka återställningslänk"}
            </button>
          </form>
        )}

        <p className="mt-5 text-center text-sm text-[var(--text-secondary)]">
          <Link href="/login" className="text-[var(--accent)] underline">
            Tillbaka till inloggning
          </Link>
        </p>
      </div>
    </div>
  );
}
