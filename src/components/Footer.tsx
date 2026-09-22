import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-[var(--surface-border)] mt-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8 text-xs text-[var(--text-muted)] leading-relaxed space-y-2">
        <p>
          TS Terminal är inte en licensierad investeringsrådgivare. Signaler och poäng
          genereras automatiskt från en regelbaserad formel, inte en bevisad
          fördel &mdash; vi har testat fem strategier mot ett brett index och
          ingen har ännu visat en statistiskt säkerställd fördel (se{" "}
          <Link href="/methodology" className="underline hover:text-[var(--text-secondary)]">
            Metodik
          </Link>
          ). Tillhandahålls endast i informationssyfte &mdash; detta är inte
          finansiell rådgivning. Sprid alltid risk över flera innehav och
          investera aldrig mer än du har råd att förlora.
        </p>
        <p>
          Drivs av Tim Sjögren som ett personligt projekt &mdash; inte av ett
          registrerat finansföretag.{" "}
          <a href="mailto:timsjogrens.jobb@gmail.com" className="underline hover:text-[var(--text-secondary)]">
            timsjogrens.jobb@gmail.com
          </a>
        </p>
      </div>
    </footer>
  );
}
