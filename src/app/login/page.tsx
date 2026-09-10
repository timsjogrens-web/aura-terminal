"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Inloggning misslyckades.");
        setLoading(false);
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setError("Kunde inte nå servern.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)] px-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[140vmax] w-[140vmax] rounded-full bg-[radial-gradient(circle,rgba(245,165,36,0.06)_0%,transparent_45%)]" />
      </div>

      <form
        onSubmit={handleSubmit}
        className="relative z-10 w-full max-w-sm rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] p-8 shadow-2xl"
      >
        <div className="flex items-center gap-3 mb-8">
          <div className="h-9 w-9 rounded-md bg-[var(--gold)] flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="h-5 w-5 text-black" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M2 12h4l3 8 4-16 3 8h4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <span className="font-sans font-bold tracking-wide text-lg">
            <span className="text-[var(--text-primary)]">AURA</span>{" "}
            <span className="text-[var(--gold)]">TERMINAL</span>
          </span>
        </div>

        <h1 className="font-serif text-2xl text-[var(--text-primary)] mb-1">Åtkomst begränsad</h1>
        <p className="text-sm text-[var(--text-secondary)] mb-6">
          Ange lösenordet för att nå terminalen.
        </p>

        <label className="block text-xs uppercase tracking-widest text-[var(--text-secondary)] mb-2">
          Lösenord
        </label>
        <input
          type="password"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-md border border-[var(--surface-border)] bg-black/40 px-3 py-2.5 font-mono text-[var(--text-primary)] outline-none focus:border-[var(--gold)] transition-colors"
          placeholder="••••••••"
        />

        {error && (
          <p className="mt-3 text-sm text-[var(--red)]">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="mt-6 w-full rounded-md bg-[var(--gold)] py-2.5 font-sans font-bold text-black tracking-wide hover:brightness-110 transition disabled:opacity-50"
        >
          {loading ? "Verifierar..." : "Logga in"}
        </button>
      </form>
    </div>
  );
}
