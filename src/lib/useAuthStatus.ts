"use client";

import { useEffect, useState } from "react";

// Whether THIS visitor is logged in as the site's one operator (Tim) — the
// site itself is public to view, but trading, watchlist edits and manual
// refreshes still require this. `null` while unknown (first paint), so
// callers can avoid flashing an owner-only control before the check lands.
export function useAuthStatus(): boolean | null {
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((json) => setLoggedIn(Boolean(json.loggedIn)))
      .catch(() => setLoggedIn(false));
  }, []);

  return loggedIn;
}
