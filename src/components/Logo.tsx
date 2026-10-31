// The mark: an open ring (a "C", the same shape as the wordmark's first
// letter) with a small dot sitting in the gap, like a signal blip — reads
// as "candor" (an open, transparent circle, nothing hidden inside it) and
// as a market signal at once. Replaces a plain typographic "C" glyph,
// which read as too plain/generic for a mark used everywhere the brand
// appears. Used everywhere the brand appears (Header, MobileNavDrawer,
// the login screen). Kept as one shared component (after two renames now
// — "Aura Terminal", then "TS Terminal", now "Candor") so all copies
// can't drift out of sync with each other the way the header nav links
// once did.
export function LogoMark({ size = 32, glow = false }: { size?: number; glow?: boolean }) {
  return (
    <div
      className={`rounded-md flex items-center justify-center shrink-0 text-black ${
        glow ? "shadow-[0_0_14px_rgba(111,176,224,0.35)]" : ""
      }`}
      style={{
        height: size,
        width: size,
        background: "linear-gradient(135deg, #9cd0f2, var(--accent) 55%, var(--accent-dim))",
      }}
    >
      <svg viewBox="0 0 24 24" width={size * 0.6} height={size * 0.6} fill="none">
        <path
          d="M18.78 16.24A8 8 0 1 1 18.78 7.76"
          stroke="currentColor"
          strokeWidth="3.1"
          strokeLinecap="round"
        />
        <circle cx="20" cy="12" r="1.9" fill="currentColor" />
      </svg>
    </div>
  );
}

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`font-sans font-bold tracking-wide whitespace-nowrap ${className}`}>
      <span className="text-[var(--accent)]">CANDOR</span>
    </span>
  );
}
