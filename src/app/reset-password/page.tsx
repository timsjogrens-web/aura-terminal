"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogoMark, Wordmark } from "@/components/Logo";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setToken(new URLSearchParams(window.location.search).get("token"));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Kunde inte återställa lösenordet.");
        return;
      }
      setDone(true);
      setTimeout(() => router.push("/login"), 2000);
    } finally {
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

        {!token ? (
          <p className="text-sm text-[var(--red)]">
            Länken saknar en giltig kod. Begär en ny på{" "}
            <Link href="/forgot-password" className="underline">
              glömt lösenord
            </Link>
            -sidan.
          </p>
        ) : done ? (
          <p className="text-sm text-[var(--green)]">Lösenordet är ändrat. Skickar dig till inloggningen…</p>
        ) : (
          <form onSubmit={handleSubmit}>
            <h1 className="font-serif text-2xl text-[var(--text-primary)] mb-1">Välj nytt lösenord</h1>
            <p className="text-sm text-[var(--text-secondary)] mb-6">Minst 8 tecken.</p>

            <input
              type="password"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-[var(--surface-border)] bg-black/40 px-3 py-2.5 font-mono text-[var(--text-primary)] outline-none focus:border-[var(--accent)] transition-colors"
              placeholder="Nytt lösenord"
            />

            {error && <p className="mt-3 text-sm text-[var(--red)]">{error}</p>}

            <button
              type="submit"
              disabled={loading || password.length < 8}
              className="mt-6 w-full rounded-md bg-[var(--accent)] py-2.5 font-sans font-bold text-black tracking-wide hover:brightness-110 transition disabled:opacity-50"
            >
              {loading ? "Sparar..." : "Spara nytt lösenord"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
