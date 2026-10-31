"use client";

import { useState } from "react";

const FALLBACK_COLORS = ["#6fb0e0", "#22c55e", "#ef4444", "#8b93a3", "#3d6f96"];

function colorFor(ticker: string): string {
  let hash = 0;
  for (let i = 0; i < ticker.length; i++) hash = (hash * 31 + ticker.charCodeAt(i)) % FALLBACK_COLORS.length;
  return FALLBACK_COLORS[Math.abs(hash) % FALLBACK_COLORS.length];
}

export default function CompanyLogo({
  ticker,
  logoUrl,
  size = 20,
}: {
  ticker: string;
  logoUrl?: string | null;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);
  const px = `${size}px`;

  if (logoUrl && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logoUrl}
        alt=""
        onError={() => setFailed(true)}
        style={{ height: px, width: px }}
        className="rounded-full object-contain bg-white/5 border border-[var(--surface-border)] shrink-0"
      />
    );
  }

  return (
    <div
      style={{ height: px, width: px, background: colorFor(ticker), fontSize: size * 0.42 }}
      className="rounded-full flex items-center justify-center font-mono font-bold text-black shrink-0"
    >
      {ticker.slice(0, 1)}
    </div>
  );
}
