"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogoMark, Wordmark } from "@/components/Logo";
import GoogleSignInButton from "@/components/GoogleSignInButton";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // Plain window.location rather than useSearchParams() — this page has
  // no other reason to opt into the Suspense boundary that hook needs at
  // build time, just to read a one-off error message from the Google
  // OAuth redirect.
  useEffect(() => {
    const message = new URLSearchParams(window.location.search).get("error");
    // Syncing from the URL (only known client-side) into state on mount —
    // there's no earlier point to read it, so this one is unavoidable.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (message) setError(message);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Inloggning misslyckades.");
        setLoading(false);
        return;
      }
      router.push("/markets");
      router.refresh();
    } catch {
      setError("Kunde inte nå servern.");
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-[var(--background)] px-4">
      {/* The stronger "space" backdrop — see .space-bg-strong in
          globals.css. This page is exactly one viewport tall, so there's
          no long scroll to fade out over; it just fills the screen. */}
      <div aria-hidden="true" className="absolute inset-0 space-bg-strong" />
      <div aria-hidden="true" className="space-twinkle" />

      <form
        onSubmit={handleSubmit}
        className="relative z-10 w-full max-w-sm rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] p-8 shadow-2xl"
      >
        <div className="flex items-center gap-3 mb-8">
          <LogoMark size={36} />
          <Wordmark className="text-lg" />
        </div>

        <h1 className="font-serif text-2xl text-[var(--text-primary)] mb-1">Logga in</h1>
        <p className="text-sm text-[var(--text-secondary)] mb-6">
          Till ditt eget konto — papperskonto, egen handel och bevakningslista.
        </p>

        <GoogleSignInButton />

        <div className="flex items-center gap-3 my-5">
          <div className="h-px flex-1 bg-[var(--surface-border)]" />
          <span className="text-xs text-[var(--text-muted)]">eller</span>
          <div className="h-px flex-1 bg-[var(--surface-border)]" />
        </div>

        <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
          E-post
        </label>
        <input
          type="email"
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-md border border-[var(--surface-border)] bg-black/40 px-3 py-2.5 mb-4 font-mono text-[var(--text-primary)] outline-none focus:border-[var(--accent)] transition-colors"
          placeholder="du@exempel.se"
        />

        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-[var(--text-secondary)]">
            Lösenord
          </label>
          <Link href="/forgot-password" className="text-xs text-[var(--accent)] hover:underline">
            Glömt lösenord?
          </Link>
        </div>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-md border border-[var(--surface-border)] bg-black/40 px-3 py-2.5 font-mono text-[var(--text-primary)] outline-none focus:border-[var(--accent)] transition-colors"
          placeholder="••••••••"
        />

        {error && <p className="mt-3 text-sm text-[var(--red)]">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="mt-6 w-full rounded-md bg-[var(--accent)] py-2.5 font-sans font-bold text-black tracking-wide hover:brightness-110 transition disabled:opacity-50"
        >
          {loading ? "Loggar in..." : "Logga in"}
        </button>

        <p className="mt-5 text-center text-sm text-[var(--text-secondary)]">
          Inget konto ännu?{" "}
          <Link href="/signup" className="text-[var(--accent)] underline">
            Skapa ett
          </Link>
        </p>
      </form>
    </div>
  );
}
