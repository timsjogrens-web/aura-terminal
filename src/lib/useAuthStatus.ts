"use client";

import { useEffect, useState } from "react";

export interface AuthStatus {
  loggedIn: boolean;
  isAdmin: boolean;
  email: string | null;
}

// Whether THIS visitor is logged in, as who, and whether they're the
// site's admin (Tim) — the site itself is public to view, but trading,
// watchlist edits and manual refreshes still require an account, and a
// few of those (the shared watchlist, forcing a global refresh, checking
// for new filings) are further restricted to the admin. `null` while
// unknown (first paint), so callers can avoid flashing an account-only
// control before the check lands.
export function useAuthStatus(): AuthStatus | null {
  const [status, setStatus] = useState<AuthStatus | null>(null);

  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((json) =>
        setStatus({
          loggedIn: Boolean(json.loggedIn),
          isAdmin: Boolean(json.isAdmin),
          email: json.email ?? null,
        })
      )
      .catch(() => setStatus({ loggedIn: false, isAdmin: false, email: null }));
  }, []);

  return status;
}
