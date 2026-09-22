"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogoMark, Wordmark } from "@/components/Logo";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Kunde inte skapa kontot.");
        setLoading(false);
        return;
      }
      router.push("/paper");
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
          <LogoMark size={36} />
          <Wordmark className="text-lg" />
        </div>

        <h1 className="font-serif text-2xl text-[var(--text-primary)] mb-1">Skapa konto</h1>
        <p className="text-sm text-[var(--text-secondary)] mb-6">
          Ditt eget papperskonto och egen handel, från $100 000 — helt separat från alla andras.
        </p>

        <label className="block text-xs uppercase tracking-widest text-[var(--text-secondary)] mb-2">
          E-post
        </label>
        <input
          type="email"
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-md border border-[var(--surface-border)] bg-black/40 px-3 py-2.5 mb-4 font-mono text-[var(--text-primary)] outline-none focus:border-[var(--gold)] transition-colors"
          placeholder="du@exempel.se"
        />

        <label className="block text-xs uppercase tracking-widest text-[var(--text-secondary)] mb-2">
          Lösenord
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-md border border-[var(--surface-border)] bg-black/40 px-3 py-2.5 font-mono text-[var(--text-primary)] outline-none focus:border-[var(--gold)] transition-colors"
          placeholder="Minst 8 tecken"
        />

        {error && <p className="mt-3 text-sm text-[var(--red)]">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="mt-6 w-full rounded-md bg-[var(--gold)] py-2.5 font-sans font-bold text-black tracking-wide hover:brightness-110 transition disabled:opacity-50"
        >
          {loading ? "Skapar konto..." : "Skapa konto"}
        </button>

        <p className="mt-5 text-center text-sm text-[var(--text-secondary)]">
          Har du redan ett konto?{" "}
          <Link href="/login" className="text-[var(--gold)] underline">
            Logga in
          </Link>
        </p>
      </form>
    </div>
  );
}
