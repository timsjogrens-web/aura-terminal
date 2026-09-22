// A "TS" monogram in a gold square, plus the "TS TERMINAL" wordmark next to
// it — used everywhere the brand appears (Header, MobileNavDrawer, the
// login screen). Kept as one shared component after the rename from "Aura
// Terminal" so all three copies can't drift out of sync with each other
// the way the header nav links once did.
export function LogoMark({ size = 32, glow = false }: { size?: number; glow?: boolean }) {
  return (
    <div
      className={`rounded-md bg-[var(--gold)] flex items-center justify-center shrink-0 ${
        glow ? "shadow-[0_0_14px_rgba(245,165,36,0.35)]" : ""
      }`}
      style={{ height: size, width: size }}
    >
      <span
        className="font-sans font-black text-black"
        style={{ fontSize: size * 0.4, letterSpacing: "-0.03em" }}
      >
        TS
      </span>
    </div>
  );
}

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`font-sans font-bold tracking-wide whitespace-nowrap ${className}`}>
      <span className="text-[var(--text-primary)]">TS</span>{" "}
      <span className="text-[var(--gold)]">TERMINAL</span>
    </span>
  );
}
