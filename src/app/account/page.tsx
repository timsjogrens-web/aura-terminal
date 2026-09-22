"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { useAuthStatus } from "@/lib/useAuthStatus";

export default function AccountPage() {
  const router = useRouter();
  const auth = useAuthStatus();
  const [resendState, setResendState] = useState<"idle" | "sending" | "sent">("idle");
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  async function resendVerification() {
    setResendState("sending");
    try {
      await fetch("/api/auth/resend-verification", { method: "POST" });
      setResendState("sent");
    } catch {
      setResendState("idle");
    }
  }

  async function handleDelete() {
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch("/api/auth/delete-account", { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) {
        setDeleteError(json.error ?? "Kunde inte radera kontot.");
        return;
      }
      router.push("/");
      router.refresh();
    } finally {
      setDeleting(false);
    }
  }

  if (auth === null) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <div className="flex-1" />
        <Footer />
      </div>
    );
  }

  if (auth.loggedIn === false) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <section className="mx-auto max-w-2xl w-full px-4 sm:px-6 pt-12 pb-16 flex-1">
          <h1 className="font-serif font-bold text-3xl text-[var(--text-primary)] mb-4">Mitt konto</h1>
          <p className="text-[var(--text-secondary)]">
            Du behöver vara inloggad för att se det här.{" "}
            <Link href="/login" className="text-[var(--gold)] underline">
              Logga in
            </Link>
            .
          </p>
        </section>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <section className="mx-auto max-w-2xl w-full px-4 sm:px-6 pt-12 pb-16 flex-1">
        <h1 className="font-serif font-bold text-3xl sm:text-4xl text-[var(--text-primary)] mb-8">
          Mitt konto
        </h1>

        <div className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] p-5 mb-6">
          <p className="text-xs font-mono tracking-widest text-[var(--text-muted)] mb-1">E-POST</p>
          <p className="text-lg text-[var(--text-primary)] mb-4">{auth.email}</p>

          <p className="text-xs font-mono tracking-widest text-[var(--text-muted)] mb-1">STATUS</p>
          <div className="flex items-center gap-2 flex-wrap mb-1">
            {auth.isAdmin && (
              <span className="text-xs font-mono bg-[rgba(245,165,36,0.12)] text-[var(--gold)] border border-[rgba(245,165,36,0.3)] rounded px-2 py-0.5">
                ADMINISTRATÖR
              </span>
            )}
            {auth.emailVerified ? (
              <span className="text-xs font-mono bg-[rgba(34,197,94,0.12)] text-[var(--green)] border border-[rgba(34,197,94,0.3)] rounded px-2 py-0.5">
                E-post bekräftad
              </span>
            ) : (
              <span className="text-xs font-mono bg-[rgba(245,165,36,0.12)] text-[var(--gold)] border border-[rgba(245,165,36,0.3)] rounded px-2 py-0.5">
                E-post ej bekräftad
              </span>
            )}
          </div>
          {!auth.emailVerified && (
            <button
              onClick={resendVerification}
              disabled={resendState !== "idle"}
              className="mt-3 text-xs font-mono border border-[var(--surface-border)] rounded px-3 py-1.5 text-[var(--text-secondary)] hover:border-[var(--gold-dim)] hover:text-[var(--text-primary)] disabled:opacity-50"
            >
              {resendState === "sent" ? "Skickat!" : resendState === "sending" ? "Skickar…" : "Skicka bekräftelsemejl igen"}
            </button>
          )}
        </div>

        <div className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] p-5 mb-6 flex flex-col gap-3">
          <p className="text-xs font-mono tracking-widest text-[var(--text-muted)]">GENVÄGAR</p>
          <div className="flex gap-2 flex-wrap">
            <Link href="/paper" className="text-sm text-[var(--gold)] underline">
              Papperskonto
            </Link>
            <Link href="/self-trade" className="text-sm text-[var(--gold)] underline">
              Egen handel
            </Link>
            <Link href="/watchlist" className="text-sm text-[var(--gold)] underline">
              Bevakningslista
            </Link>
            <Link href="/forgot-password" className="text-sm text-[var(--gold)] underline">
              Byt lösenord
            </Link>
          </div>
        </div>

        <div className="mb-6">
          <button
            onClick={handleLogout}
            className="text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--gold)] border border-[var(--surface-border)] rounded-md px-4 py-2 transition"
          >
            Logga ut
          </button>
        </div>

        <div className="rounded-lg border border-[rgba(239,68,68,0.35)] bg-[rgba(239,68,68,0.04)] p-5">
          <p className="text-xs font-mono tracking-widest text-[var(--red)] mb-2">FARLIG ZON</p>
          <p className="text-sm text-[var(--text-secondary)] mb-4">
            Raderar kontot permanent — papperskonto, egen handel, bevakningslista, allt. Går inte
            att ångra.
          </p>
          <label className="block text-xs font-mono text-[var(--text-muted)] mb-1.5">
            Skriv <strong className="text-[var(--text-primary)]">RADERA</strong> för att bekräfta
          </label>
          <div className="flex gap-3 flex-wrap items-start">
            <input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              className="w-40 rounded-md border border-[var(--surface-border)] bg-black/30 px-3 py-2 text-sm font-mono text-[var(--text-primary)] outline-none focus:border-[var(--red)]"
              placeholder="RADERA"
            />
            <button
              onClick={handleDelete}
              disabled={confirmText !== "RADERA" || deleting}
              className="px-4 py-2 rounded-md text-sm font-semibold bg-[var(--red)] text-black transition disabled:opacity-40"
            >
              {deleting ? "Raderar…" : "Radera mitt konto"}
            </button>
          </div>
          {deleteError && <p className="text-sm text-[var(--red)] mt-3">{deleteError}</p>}
        </div>
      </section>

      <Footer />
    </div>
  );
}
