"use client";

import { useState } from "react";
import { MANAGERS_BY_SLUG, initials } from "@/lib/investors";

export default function ManagerAvatar({ slug, name, size }: { slug: string; name: string; size: number }) {
  const [failed, setFailed] = useState(false);
  const photoUrl = MANAGERS_BY_SLUG.get(slug)?.photoUrl;
  const px = `${size}px`;

  if (photoUrl && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photoUrl}
        alt={name}
        onError={() => setFailed(true)}
        style={{ height: px, width: px }}
        className="rounded-full object-cover border border-[var(--surface-border)] shrink-0"
      />
    );
  }
  return (
    <div
      style={{ height: px, width: px }}
      className="rounded-full bg-[rgba(245,165,36,0.12)] border border-[rgba(245,165,36,0.3)] flex items-center justify-center text-[var(--gold)] font-mono font-bold text-sm shrink-0"
    >
      {initials(name)}
    </div>
  );
}
