"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { useAuthStatus } from "@/lib/useAuthStatus";
import { timeAgo } from "@/lib/format";

interface AdminUser {
  id: number;
  email: string;
  isAdmin: boolean;
  botEnabled: boolean;
  emailVerified: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

export default function AdminUsersPage() {
  const auth = useAuthStatus();
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (auth?.isAdmin !== true) return;
    fetch("/api/admin/users")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((json) => setUsers(json.users))
      .catch(() => setError("Kunde inte ladda kontolistan."));
  }, [auth]);

  if (auth === null) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <div className="flex-1" />
        <Footer />
      </div>
    );
  }

  if (!auth.isAdmin) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <section className="mx-auto max-w-2xl w-full px-4 sm:px-6 pt-12 pb-16 flex-1">
          <h1 className="font-serif font-bold text-3xl text-[var(--text-primary)] mb-4">Konton</h1>
          <p className="text-[var(--text-secondary)]">
            Den här sidan är bara synlig för sajtens administratör.{" "}
            {auth.loggedIn === false && (
              <>
                <Link href="/login" className="text-[var(--accent)] underline">
                  Logga in
                </Link>
                .
              </>
            )}
          </p>
        </section>
        <Footer />
      </div>
    );
  }

  const verifiedCount = users?.filter((u) => u.emailVerified).length ?? 0;
  const botCount = users?.filter((u) => u.botEnabled).length ?? 0;
  const loggedInEverCount = users?.filter((u) => u.lastLoginAt !== null).length ?? 0;

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <section className="mx-auto max-w-5xl w-full px-4 sm:px-6 pt-12 pb-16 flex-1">
        <h1 className="font-serif font-bold text-3xl sm:text-4xl text-[var(--text-primary)] mb-2">
          Konton
        </h1>
        <p className="text-[var(--text-secondary)] mb-8 max-w-2xl">
          Alla registrerade konton på sajten — vem som skapat ett konto, om de bekräftat sin
          e-post, om de har boten på, och när de senast loggade in. Bara du ser den här sidan.
        </p>

        {error && (
          <div className="rounded-lg border border-[rgba(239,68,68,0.35)] bg-[rgba(239,68,68,0.08)] px-4 py-3 text-sm text-[var(--red)] mb-8">
            {error}
          </div>
        )}

        {!users && !error && <p className="text-[var(--text-muted)]">Laddar…</p>}

        {users && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
              <div className="rounded-lg border border-[var(--surface-border)] border-l-[3px] border-l-[var(--accent)] bg-[var(--surface)] p-4">
                <p className="text-sm font-medium text-[var(--text-secondary)] mb-1">Konton totalt</p>
                <p className="font-mono text-xl font-bold text-[var(--text-primary)]">{users.length}</p>
              </div>
              <div className="rounded-lg border border-[var(--surface-border)] border-l-[3px] border-l-[var(--green)] bg-[var(--surface)] p-4">
                <p className="text-sm font-medium text-[var(--text-secondary)] mb-1">Har loggat in</p>
                <p className="font-mono text-xl font-bold text-[var(--text-primary)]">{loggedInEverCount}</p>
              </div>
              <div className="rounded-lg border border-[var(--surface-border)] border-l-[3px] border-l-[var(--surface-border)] bg-[var(--surface)] p-4">
                <p className="text-sm font-medium text-[var(--text-secondary)] mb-1">E-post bekräftad</p>
                <p className="font-mono text-xl font-bold text-[var(--text-primary)]">{verifiedCount}</p>
              </div>
              <div className="rounded-lg border border-[var(--surface-border)] border-l-[3px] border-l-[var(--surface-border)] bg-[var(--surface)] p-4">
                <p className="text-sm font-medium text-[var(--text-secondary)] mb-1">Boten på</p>
                <p className="font-mono text-xl font-bold text-[var(--text-primary)]">{botCount}</p>
              </div>
            </div>

            <div className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--surface-border)] text-left text-xs font-mono tracking-widest text-[var(--text-muted)]">
                      <th className="px-4 py-3 font-medium">E-POST</th>
                      <th className="px-4 py-3 font-medium">STATUS</th>
                      <th className="px-4 py-3 font-medium">SKAPAT</th>
                      <th className="px-4 py-3 font-medium">SENAST INLOGGAD</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.id} className="border-b border-[var(--surface-border)] last:border-0">
                        <td className="px-4 py-3 font-mono text-[var(--text-primary)] whitespace-nowrap">
                          {u.email}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {u.isAdmin && (
                              <span className="text-[10px] font-mono bg-[rgba(111,176,224,0.12)] text-[var(--accent)] border border-[rgba(111,176,224,0.3)] rounded px-1.5 py-0.5">
                                ADMIN
                              </span>
                            )}
                            <span
                              className={`text-[10px] font-mono rounded px-1.5 py-0.5 border ${
                                u.emailVerified
                                  ? "bg-[rgba(34,197,94,0.12)] text-[var(--green)] border-[rgba(34,197,94,0.3)]"
                                  : "bg-[rgba(240,160,32,0.12)] text-[var(--amber)] border-[rgba(240,160,32,0.3)]"
                              }`}
                            >
                              {u.emailVerified ? "VERIFIERAD" : "EJ VERIFIERAD"}
                            </span>
                            {u.botEnabled && (
                              <span className="text-[10px] font-mono bg-[rgba(34,197,94,0.12)] text-[var(--green)] border border-[rgba(34,197,94,0.3)] rounded px-1.5 py-0.5">
                                BOT PÅ
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-[var(--text-secondary)] whitespace-nowrap">
                          {timeAgo(u.createdAt)}
                        </td>
                        <td className="px-4 py-3 text-[var(--text-secondary)] whitespace-nowrap">
                          {u.lastLoginAt ? timeAgo(u.lastLoginAt) : "aldrig"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </section>

      <Footer />
    </div>
  );
}
