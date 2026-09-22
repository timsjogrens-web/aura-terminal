// A plain link (not a client-side fetch) — signing in with Google has to
// be a full top-level navigation to Google's consent screen, so a normal
// <a> is exactly what's needed, no client component required.
export default function GoogleSignInButton() {
  return (
    <a
      href="/api/auth/google/start"
      className="flex w-full items-center justify-center gap-2.5 rounded-md border border-[var(--surface-border)] bg-black/20 py-2.5 font-sans font-medium text-sm text-[var(--text-primary)] hover:border-[var(--gold-dim)] hover:bg-black/30 transition"
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
        <path
          fill="#4285F4"
          d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47a5.5 5.5 0 0 1-2.4 3.61v3h3.87c2.27-2.09 3.55-5.17 3.55-8.85Z"
        />
        <path
          fill="#34A853"
          d="M12 24c3.24 0 5.95-1.07 7.94-2.9l-3.87-3a7.17 7.17 0 0 1-4.07 1.14c-3.13 0-5.78-2.11-6.73-4.96H1.24v3.1A11.99 11.99 0 0 0 12 24Z"
        />
        <path
          fill="#FBBC05"
          d="M5.27 14.28a7.2 7.2 0 0 1 0-4.56v-3.1H1.24a12 12 0 0 0 0 10.76l4.03-3.1Z"
        />
        <path
          fill="#EA4335"
          d="M12 4.75c1.76 0 3.34.61 4.58 1.79l3.43-3.43C17.94 1.17 15.24 0 12 0A11.99 11.99 0 0 0 1.24 6.62l4.03 3.1C6.22 6.86 8.87 4.75 12 4.75Z"
        />
      </svg>
      Fortsätt med Google
    </a>
  );
}
