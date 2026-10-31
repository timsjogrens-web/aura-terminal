"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import CompanyLogo from "@/components/CompanyLogo";
import { useAuthStatus } from "@/lib/useAuthStatus";
import { formatPct, formatPrice, timeAgo } from "@/lib/format";

interface Position {
  ticker: string;
  shares: number;
  entryPrice: number;
  entryDate: string;
  currentPrice: number;
  value: number;
  returnPct: number;
  stopLossPrice: number;
  trailingArmed: boolean;
  trailingStopPrice: number | null;
  peakPrice: number;
  logo?: string | null;
}

interface Trade {
  id: number;
  ticker: string;
  action: "BUY" | "SELL";
  shares: number;
  price: number;
  timestamp: string;
  reason: string;
  logo?: string | null;
}

interface PaperData {
  botEnabled: boolean;
  startingCash: number;
  cash: number;
  totalValue: number;
  totalReturnPct: number;
  unrealizedPnl: number;
  realizedPnl: number;
  startedAt: string | null;
  positions: Position[];
  trades: Trade[];
  spyComparison: { returnPct: number } | null;
}

function formatMoney(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function formatSignedMoney(n: number): string {
  const sign = n >= 0 ? "+" : "";
  return sign + formatMoney(n);
}

export default function PaperTradingPage() {
  const router = useRouter();
  const auth = useAuthStatus();
  const loggedIn = auth ? auth.loggedIn : null; // anyone with an account can run their own bot
  const [data, setData] = useState<PaperData | null>(null);
  const [togglingBot, setTogglingBot] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [verifyResult, setVerifyResult] = useState<"ok" | "invalid" | "missing" | null>(null);
  const [resendState, setResendState] = useState<"idle" | "sending" | "sent">("idle");
  // Collapsed by default — the bot on/off toggle and the actual numbers
  // are the whole point of this page, and they used to sit below a wall
  // of explanatory text (the mechanics paragraph + a dated notice), which
  // read as "just an explanation page" to people seeing it for the first
  // time (friends testing the site never noticed there was a real bot to
  // switch on). Same information, just tucked behind a click instead of
  // forced on everyone up front.
  const [showDetails, setShowDetails] = useState(false);

  const loadData = useCallback(() => {
    fetch("/api/paper")
      .then((r) => (r.ok ? r.json() : null))
      .then(setData)
      .catch(() => setData(null));
  }, []);

  useEffect(() => {
    if (loggedIn === true) loadData();
  }, [loggedIn, loadData]);

  // Reads one-off flags from the signup / email-verification redirects —
  // only known client-side, so this can't happen any earlier than mount.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (params.get("welcome") === "1") setShowWelcome(true);
    const verify = params.get("verify");
    if (verify === "ok" || verify === "invalid" || verify === "missing") setVerifyResult(verify);
  }, []);

  async function resendVerification() {
    setResendState("sending");
    try {
      await fetch("/api/auth/resend-verification", { method: "POST" });
      setResendState("sent");
    } catch {
      setResendState("idle");
    }
  }

  async function toggleBot() {
    if (!data) return;
    setTogglingBot(true);
    try {
      await fetch("/api/paper", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !data.botEnabled }),
      });
      loadData();
    } finally {
      setTogglingBot(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <section className="mx-auto max-w-5xl w-full px-4 sm:px-6 pt-12 pb-16 flex-1">
        <div className="flex items-start justify-between gap-4 flex-wrap mb-2">
          <h1 className="font-serif font-bold text-3xl sm:text-4xl text-[var(--text-primary)]">
            Papperskonto
          </h1>
          <span className="text-[10px] font-mono tracking-widest bg-[rgba(239,68,68,0.12)] text-[var(--red)] border border-[rgba(239,68,68,0.35)] rounded px-2 py-1 self-start">
            SIMULERAT · INGA RIKTIGA PENGAR
          </span>
        </div>
        <p className="text-sm text-[var(--text-secondary)] mb-6 max-w-2xl">
          Boten köper och säljer automatiskt åt dig, live, baserat på dagens signaler — ingen
          historik. Vill du handla själv istället?{" "}
          <Link href="/self-trade" className="text-[var(--accent)] underline">
            Se egen handel
          </Link>
          . Vill du se hur det hade gått bakåt i tiden?{" "}
          <Link href="/track-record" className="text-[var(--accent)] underline">
            Se track record
          </Link>
          .
        </p>

        {showWelcome && (
          <div className="rounded-lg border border-[rgba(111,176,224,0.35)] bg-[rgba(111,176,224,0.06)] p-5 mb-6 max-w-2xl">
            <div className="flex items-start justify-between gap-3">
              <p className="font-serif font-bold text-lg text-[var(--text-primary)] mb-2">
                Välkommen till Candor! 🎉
              </p>
              <button
                onClick={() => setShowWelcome(false)}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)] text-sm"
                aria-label="Stäng"
              >
                ✕
              </button>
            </div>
            <p className="text-sm text-[var(--text-secondary)] mb-3">
              Ditt konto är klart, med $100 000 att öva med. Tre saker att göra härnäst:
            </p>
            <ul className="text-sm text-[var(--text-secondary)] space-y-1.5 mb-3 list-disc list-inside">
              <li>
                <strong className="text-[var(--text-primary)]">Sätt igång boten</strong> nedan om
                du vill att den handlar automatiskt åt dig på STRONG BUY-signaler.
              </li>
              <li>
                Eller testa{" "}
                <Link href="/self-trade" className="text-[var(--accent)] underline">
                  egen handel
                </Link>{" "}
                och välj dina egna affärer.
              </li>
              <li>
                Bygg din{" "}
                <Link href="/watchlist" className="text-[var(--accent)] underline">
                  bevakningslista
                </Link>{" "}
                med aktier du vill följa.
              </li>
            </ul>
            <p className="text-xs text-[var(--text-muted)]">
              Läs gärna{" "}
              <Link href="/methodology" className="underline hover:text-[var(--text-secondary)]">
                metodiken
              </Link>{" "}
              för en ärlig bild av vad som är testat och inte.
            </p>
          </div>
        )}

        {verifyResult === "ok" && (
          <div className="rounded-lg border border-[rgba(34,197,94,0.35)] bg-[rgba(34,197,94,0.06)] px-4 py-3 mb-6 max-w-2xl text-sm text-[var(--green)]">
            E-postadressen är bekräftad. Tack!
          </div>
        )}
        {(verifyResult === "invalid" || verifyResult === "missing") && (
          <div className="rounded-lg border border-[rgba(239,68,68,0.35)] bg-[rgba(239,68,68,0.06)] px-4 py-3 mb-6 max-w-2xl text-sm text-[var(--red)]">
            Länken för att bekräfta e-post är ogiltig eller har gått ut. Begär en ny nedan om du
            fortfarande behöver bekräfta.
          </div>
        )}

        {auth?.loggedIn && auth.emailVerified === false && (
          <div className="rounded-lg border border-[var(--accent-dim)] bg-[rgba(111,176,224,0.06)] px-4 py-3 mb-6 max-w-2xl text-sm text-[var(--text-secondary)] flex items-center justify-between gap-3 flex-wrap">
            <span>Bekräfta din e-postadress — vi skickade en länk när du registrerade dig.</span>
            <button
              onClick={resendVerification}
              disabled={resendState !== "idle"}
              className="text-xs font-mono border border-[var(--surface-border)] rounded px-3 py-1.5 text-[var(--text-secondary)] hover:border-[var(--accent-dim)] hover:text-[var(--text-primary)] disabled:opacity-50 shrink-0"
            >
              {resendState === "sent" ? "Skickat!" : resendState === "sending" ? "Skickar…" : "Skicka igen"}
            </button>
          </div>
        )}

        {loggedIn === false && (
          <div className="rounded-lg border border-[var(--accent-dim)] bg-[rgba(111,176,224,0.06)] px-4 py-3 mb-6 text-sm text-[var(--text-secondary)] max-w-2xl">
            Du behöver ett konto för att köra din egen bot.{" "}
            <Link href="/signup" className="text-[var(--accent)] underline">
              Skapa konto
            </Link>{" "}
            (startar på $100 000) eller{" "}
            <Link href="/login" className="text-[var(--accent)] underline">
              logga in
            </Link>
            .
          </div>
        )}

        {/* The actual hook — moved above all the explanatory text instead
            of below it. This is a real, switchable bot, not just a page
            about one. */}
        {data && (
          <div
            className={`rounded-lg border px-4 py-3 mb-3 max-w-2xl flex items-center justify-between gap-4 flex-wrap ${
              data.botEnabled
                ? "border-[rgba(34,197,94,0.35)] bg-[rgba(34,197,94,0.06)]"
                : "border-[var(--surface-border)] bg-[var(--surface)]"
            }`}
          >
            <div>
              <p className={`text-xs font-mono tracking-widest mb-0.5 ${data.botEnabled ? "text-[var(--green)]" : "text-[var(--text-muted)]"}`}>
                {data.botEnabled ? "BOTEN ÄR PÅ" : "BOTEN ÄR AV"}
              </p>
              <p className="text-sm text-[var(--text-secondary)]">
                {data.botEnabled
                  ? "Handlar automatiskt på nya signaler från och med när du satte igång den."
                  : "Ingen handel sker förrän du sätter igång den."}
              </p>
            </div>
            <button
              onClick={toggleBot}
              disabled={togglingBot}
              className={`px-4 py-2 rounded-md text-sm font-semibold transition disabled:opacity-50 ${
                data.botEnabled
                  ? "border border-[var(--surface-border)] text-[var(--text-secondary)] hover:text-[var(--red)] hover:border-[var(--red)]"
                  : "bg-[var(--green)] text-black hover:brightness-110"
              }`}
            >
              {togglingBot ? "…" : data.botEnabled ? "Stäng av boten" : "Sätt igång boten"}
            </button>
          </div>
        )}

        <p className="text-sm text-[var(--text-secondary)] mb-8 max-w-2xl flex items-center gap-2 flex-wrap">
          Boten köper/säljer automatiskt på STRONG BUY-signaler med ett fiktivt{" "}
          {data ? formatMoney(data.startingCash) : "$100,000"}-konto.
          <button
            onClick={() => setShowDetails((v) => !v)}
            className="text-[var(--accent)] hover:underline font-medium shrink-0"
          >
            {showDetails ? "Visa mindre" : "Hur funkar det? Visa mer"}
          </button>
        </p>

        {showDetails && (
          <div className="mb-8 max-w-2xl flex flex-col gap-4">
            <p className="text-[var(--text-secondary)] text-sm">
              När boten är på köper den automatiskt i samma stund en aktie når STRONG BUY (den
              högsta signalnivån — vanlig BUY visas fortfarande på sajten men auto-handlas inte
              längre, se notisen nedan), och säljer i samma stund signalen blir SELL eller STRONG
              SELL. Två skyddsnät ligger ovanpå signalen: en fast stop-loss på 10% under
              ingångspriset, och en trailing stop som låser in vinst när en position gått upp 15%+
              (säljer om den sedan backar 10% från sin topp) — båda visas som anledning i
              handelsloggen nedan.
            </p>

            <div className="rounded-lg border border-[var(--surface-border)] bg-black/20 px-4 py-3 text-xs text-[var(--text-secondary)] leading-relaxed">
              <p className="font-mono tracking-widest text-[var(--text-muted)] mb-1.5">
                NOTIS, 27 OKTOBER 2026 — STOP-LOSSEN TESTAD, FLYTTAD 8% → 10%
              </p>
              <p>
                Stop-loss, trailing-start och trailing-stop (8%/15%/10%) var tidigare bara vanliga
                tumregler från teknisk analys-litteraturen, aldrig testade mot den här specifika
                signalmotorn. Testade alla tre var för sig (en i taget, de andra vid sina
                nuvarande värden, samma 2 år delat i två halvor). 5% stop-loss gick back i båda
                halvorna — för snäv, stoppas ur innan normal studs hinner vända. 10% gick plus i
                båda halvorna och var klart jämnare mellan dem än 8% (+1,6%/+3,3% mot 8%:s
                +8,5%/+1,4%), med högre totalavkastning och färre affärer som stängdes inom 3
                dagar. Flyttad till 10%. Trailing-start (15%) och trailing-stop (10%) testades på
                samma sätt — ingen annan siffra slog dem på både jämnhet och avkastning, så de
                lämnas oförändrade. Samma brasklapp som alltid: 2 års data, inget bevis för
                framtiden — se{" "}
                <Link href="/methodology" className="underline hover:text-[var(--text-primary)]">
                  metodiken
                </Link>
                .
              </p>
            </div>

            <div className="rounded-lg border border-[var(--surface-border)] bg-black/20 px-4 py-3 text-xs text-[var(--text-secondary)] leading-relaxed">
              <p className="font-mono tracking-widest text-[var(--text-muted)] mb-1.5">
                NOTIS, 21 OKTOBER 2026 — SÄLJREGELN BLEV MINDRE NERVÖS
              </p>
              <p>
                Boten sålde tidigare direkt när en innehavd aktie föll av BUY/STRONG BUY till
                bara HOLD, inte bara vid en faktisk säljsignal. Flera konton drabbades av precis
                vad det låter som: en aktie pendlade runt gränsen, boten köpte och sålde samma
                aktie flera gånger på några dagar, oftast med en liten förlust varje gång. En
                sweep över samma 2 år som köpregeln testades på (samma universum, samma riskstopp,
                bara säljvillkoret varierat, delat i två halvor var för sig) visade att den gamla
                regeln var den ENDA av fyra testade varianter som gick back i någon av halvorna
                (-3,1% första halvan, +15,8% andra, +8,4% i snitt) — att bara sälja på en faktisk
                SELL/STRONG SELL-signal gick plus i båda halvorna (+8,5%, +1,4%) och halverade
                andelen affärer som stängdes inom 3 dagar (24% → 12%). Valdes framför två
                strängare varianter som backtestade ännu bättre eftersom de kräver ett nytt,
                godtyckligt antal dagar — exakt den typen av överanpassning den här sajten annars
                undviker. Samma brasklapp som för köpregeln: 2 års data, ingen äkta orörd
                testperiod, inget bevis för framtiden — se{" "}
                <Link href="/methodology" className="underline hover:text-[var(--text-primary)]">
                  metodiken
                </Link>
                .
              </p>
            </div>

            <div className="rounded-lg border border-[var(--surface-border)] bg-black/20 px-4 py-3 text-xs text-[var(--text-secondary)] leading-relaxed">
              <p className="font-mono tracking-widest text-[var(--text-muted)] mb-1.5">
                NOTIS, 22 SEPTEMBER 2026 — BOTEN BLEV MER SELEKTIV
              </p>
              <p>
                Boten köpte tidigare på både BUY och STRONG BUY. En backtest över de senaste 2 åren
                visade att strategin fick tydligt bättre resultat (och lägre nedgångar) ju mer
                selektiv den blev, och höll i sig i båda halvorna av perioden var för sig — inte
                bara en lyckad period. Boten köper nu bara på STRONG BUY. Ärlig brasklapp: detta är
                testat på samma 2 år som vi bara har tillgång till, inte ett facit på framtiden — se{" "}
                <Link href="/methodology" className="underline hover:text-[var(--text-primary)]">
                  metodiken
                </Link>{" "}
                för detaljer.
              </p>
            </div>

            {/* Only relevant to an account that already existed during that
                window — irrelevant (and confusing) for anyone who signs up
                after the fact, so it's shown only if this account's history
                actually reaches back that far. */}
            {data?.startedAt && new Date(data.startedAt) <= new Date("2026-09-16T23:59:59Z") && (
              <div className="rounded-lg border border-[var(--surface-border)] bg-black/20 px-4 py-3 text-xs text-[var(--text-secondary)] leading-relaxed">
                <p className="font-mono tracking-widest text-[var(--text-muted)] mb-1.5">
                  NOTIS, 9–16 SEPTEMBER 2026
                </p>
                <p>
                  Under kontots första vecka uppdaterades priserna av misstag var 15:e minut
                  istället för en gång per dag som är tänkt, på grund av en bugg i
                  utvecklingsmiljön — det gav fler affärer än vad kontot normalt skulle göra,
                  vilket sannolikt gjort resultatet sämre än det annars hade blivit. Bortsett från
                  antalet affärer är siffrorna äkta och orörda — vi visar dem som de är, inklusive
                  en dålig vecka, istället för att städa bort den. Buggen är fixad 16 september.
                </p>
              </div>
            )}

            {/* Same "existed before the fix" scoping as the notice above.
                Only Tim's admin account is old enough to hit this. */}
            {data?.startedAt && new Date(data.startedAt) <= new Date("2026-09-18T23:59:59Z") && (
              <div className="rounded-lg border border-[var(--surface-border)] bg-black/20 px-4 py-3 text-xs text-[var(--text-secondary)] leading-relaxed">
                <p className="font-mono tracking-widest text-[var(--text-muted)] mb-1.5">
                  NOTIS, 18 SEPTEMBER 2026 — RÄTTAD 23 SEPTEMBER
                </p>
                <p>
                  Två uppdateringskörningar råkade gå samtidigt och köpte ANET dubbelt (en
                  låsningsbugg i uppdateringsjobbet, inte i själva signalen) — kontot ägde
                  tillfälligt dubbelt så mycket ANET som avsett, utan att motsvarande belopp drogs
                  från kassan. Det blåste upp avkastningen med cirka $5 200 (ungefär +4,9
                  procentenheter) tills det upptäcktes. Den extra affären är borttagen och boken
                  stämmer nu exakt mot handelsloggen igen; låsningsbuggen är fixad så det inte kan
                  hända igen.
                </p>
              </div>
            )}
          </div>
        )}

        {loggedIn === true && !data && <p className="text-[var(--text-muted)]">Laddar…</p>}

        {data && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
              <div className="rounded-lg border border-[var(--surface-border)] border-l-[3px] border-l-[var(--surface-border)] bg-[var(--surface)] p-4">
                <p className="text-sm font-medium text-[var(--text-secondary)] mb-1">Totalt värde</p>
                <p className="font-mono text-xl font-bold text-[var(--text-primary)]">
                  {formatMoney(data.totalValue)}
                </p>
              </div>
              <div
                className={`rounded-lg border border-[var(--surface-border)] border-l-[3px] bg-[var(--surface)] p-4 ${
                  data.totalReturnPct >= 0 ? "border-l-[var(--green)]" : "border-l-[var(--red)]"
                }`}
              >
                <p className="text-sm font-medium text-[var(--text-secondary)] mb-1">Avkastning</p>
                <p
                  className={`font-mono text-xl font-bold ${
                    data.totalReturnPct >= 0 ? "text-[var(--green)]" : "text-[var(--red)]"
                  }`}
                >
                  {formatPct(data.totalReturnPct)}
                </p>
              </div>
              <div className="rounded-lg border border-[var(--surface-border)] border-l-[3px] border-l-[var(--surface-border)] bg-[var(--surface)] p-4">
                <p className="text-sm font-medium text-[var(--text-secondary)] mb-1">Kontanter</p>
                <p className="font-mono text-xl font-bold text-[var(--text-primary)]">
                  {formatMoney(data.cash)}
                </p>
              </div>
              <div className="rounded-lg border border-[var(--surface-border)] border-l-[3px] border-l-[var(--accent)] bg-[var(--surface)] p-4">
                <p className="text-sm font-medium text-[var(--text-secondary)] mb-1">Öppna positioner</p>
                <p className="font-mono text-xl font-bold text-[var(--text-primary)]">
                  {data.positions.length}
                </p>
              </div>
            </div>

            {/* Why AVKASTNING above doesn't just match what the open-positions
                table below shows: it's this split, not a bug — a currently
                green book (unrealized) sitting on top of losses already
                locked in from trades that already closed (realized). */}
            {(data.unrealizedPnl !== 0 || data.realizedPnl !== 0) && (
              <p className="text-xs font-mono text-[var(--text-muted)] mb-8 -mt-4">
                Orealiserat (öppna positioner):{" "}
                <span className={data.unrealizedPnl >= 0 ? "text-[var(--green)]" : "text-[var(--red)]"}>
                  {formatSignedMoney(data.unrealizedPnl)}
                </span>
                {" · "}
                Realiserat (avslutade affärer hittills):{" "}
                <span className={data.realizedPnl >= 0 ? "text-[var(--green)]" : "text-[var(--red)]"}>
                  {formatSignedMoney(data.realizedPnl)}
                </span>
              </p>
            )}

            {data.startedAt && (
              <div className="rounded-lg border border-[rgba(111,176,224,0.3)] bg-[rgba(111,176,224,0.05)] p-5 mb-8 flex items-center justify-between flex-wrap gap-4">
                <div>
                  <p className="text-xs font-mono tracking-widest text-[var(--accent)] mb-1">VS. S&amp;P 500</p>
                  <p className="text-sm text-[var(--text-secondary)]">
                    Samma {formatMoney(data.startingCash)} i SPY sedan den första affären ({timeAgo(data.startedAt)})
                  </p>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className="text-xs font-mono text-[var(--text-muted)]">SIGNALMOTOR</p>
                    <p
                      className={`font-mono text-lg font-bold ${
                        data.totalReturnPct >= 0 ? "text-[var(--green)]" : "text-[var(--red)]"
                      }`}
                    >
                      {formatPct(data.totalReturnPct)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-mono text-[var(--text-muted)]">S&amp;P 500</p>
                    {data.spyComparison ? (
                      <p
                        className={`font-mono text-lg font-bold ${
                          data.spyComparison.returnPct >= 0 ? "text-[var(--green)]" : "text-[var(--red)]"
                        }`}
                      >
                        {formatPct(data.spyComparison.returnPct)}
                      </p>
                    ) : (
                      <p className="font-mono text-lg text-[var(--text-muted)]">—</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {data.positions.length > 0 && (
              <div className="mb-8">
                <p className="text-xs font-mono tracking-widest text-[var(--text-muted)] mb-3">ÖPPNA POSITIONER</p>
                <div className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] overflow-hidden">
                  <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[var(--surface-border)] text-left text-xs font-mono tracking-widest text-[var(--text-muted)]">
                        <th className="px-2.5 sm:px-4 py-3 font-medium">TICKER</th>
                        <th className="px-2.5 sm:px-4 py-3 font-medium text-right">ANTAL</th>
                        <th className="px-2.5 sm:px-4 py-3 font-medium text-right">INGÅNG</th>
                        <th className="px-2.5 sm:px-4 py-3 font-medium text-right">NUVARANDE</th>
                        <th className="px-2.5 sm:px-4 py-3 font-medium text-right">AVKASTNING</th>
                        <th className="px-2.5 sm:px-4 py-3 font-medium text-right">VÄRDE</th>
                        <th className="px-2.5 sm:px-4 py-3 font-medium text-right">SÄLJS VID</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.positions.map((p) => {
                        // Once the trailing stop is armed it's always the tighter,
                        // more protective level (it requires +15% gain first, so
                        // it's mathematically always above the entry-based
                        // stop-loss) — showing both side by side made the static
                        // stop-loss number look stale/wrong once price had moved
                        // well past it. This shows whichever one is actually the
                        // live sell trigger right now, with the other as a tooltip.
                        const usingTrailing = p.trailingArmed && p.trailingStopPrice !== null;
                        const sellsAt = usingTrailing ? p.trailingStopPrice! : p.stopLossPrice;
                        return (
                          <tr
                            key={p.ticker}
                            onClick={() => router.push(`/stock/${p.ticker}`)}
                            className="border-b border-[var(--surface-border)] last:border-0 hover:bg-black/20 cursor-pointer transition-colors"
                          >
                            <td className="px-2.5 sm:px-4 py-3">
                              <Link
                                href={`/stock/${p.ticker}`}
                                onClick={(e) => e.stopPropagation()}
                                className="flex items-center gap-2 font-mono font-semibold text-[var(--accent)] hover:underline"
                              >
                                <CompanyLogo ticker={p.ticker} logoUrl={p.logo} size={20} />
                                {p.ticker}
                              </Link>
                            </td>
                            <td className="px-2.5 sm:px-4 py-3 text-right font-mono text-[var(--text-secondary)] whitespace-nowrap">
                              {p.shares.toFixed(2)}
                            </td>
                            <td className="px-2.5 sm:px-4 py-3 text-right font-mono text-[var(--text-secondary)] whitespace-nowrap">
                              ${formatPrice(p.entryPrice)}
                            </td>
                            <td className="px-2.5 sm:px-4 py-3 text-right font-mono text-[var(--text-primary)] whitespace-nowrap">
                              ${formatPrice(p.currentPrice)}
                            </td>
                            <td
                              className={`px-2.5 sm:px-4 py-3 text-right font-mono whitespace-nowrap ${
                                p.returnPct >= 0 ? "text-[var(--green)]" : "text-[var(--red)]"
                              }`}
                            >
                              {formatPct(p.returnPct)}
                            </td>
                            <td className="px-2.5 sm:px-4 py-3 text-right font-mono text-[var(--text-primary)] whitespace-nowrap">
                              {formatMoney(p.value)}
                            </td>
                            <td
                              className={`px-2.5 sm:px-4 py-3 text-right font-mono whitespace-nowrap ${
                                usingTrailing ? "text-[var(--accent)]" : "text-[var(--red)]"
                              }`}
                              title={
                                usingTrailing
                                  ? `Trailing stop, låses in vid +15%. Golv för fast stop-loss: $${formatPrice(p.stopLossPrice)}`
                                  : "Fast stop-loss, 8% under ingångspriset. Trailing stop tar över vid +15%."
                              }
                            >
                              ${formatPrice(sellsAt)} <span className="text-[10px] opacity-70">{usingTrailing ? "trail" : "stop"}</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  </div>
                </div>
              </div>
            )}

            <div>
              <p className="text-xs font-mono tracking-widest text-[var(--text-muted)] mb-3">HANDELSLOGG</p>
              {data.trades.length === 0 ? (
                <p className="text-[var(--text-muted)] text-sm">
                  Inga affärer ännu — portföljen köper automatiskt nästa gång en spårad aktie
                  når BUY eller STRONG BUY.
                </p>
              ) : (
                <div className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] overflow-hidden">
                  <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[var(--surface-border)] text-left text-xs font-mono tracking-widest text-[var(--text-muted)]">
                        <th className="px-2.5 sm:px-4 py-3 font-medium">ÅTGÄRD</th>
                        <th className="px-2.5 sm:px-4 py-3 font-medium">TICKER</th>
                        <th className="px-2.5 sm:px-4 py-3 font-medium text-right">ANTAL</th>
                        <th className="px-2.5 sm:px-4 py-3 font-medium text-right">PRIS</th>
                        <th className="px-2.5 sm:px-4 py-3 font-medium">ANLEDNING</th>
                        <th className="px-2.5 sm:px-4 py-3 font-medium text-right">NÄR</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.trades.map((t) => (
                        <tr
                          key={t.id}
                          onClick={() => router.push(`/stock/${t.ticker}`)}
                          className="border-b border-[var(--surface-border)] last:border-0 hover:bg-black/20 cursor-pointer transition-colors"
                        >
                          <td className="px-2.5 sm:px-4 py-3">
                            <span
                              className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${
                                t.action === "BUY"
                                  ? "bg-[rgba(34,197,94,0.12)] text-[var(--green)]"
                                  : "bg-[rgba(239,68,68,0.12)] text-[var(--red)]"
                              }`}
                            >
                              {t.action}
                            </span>
                          </td>
                          <td className="px-2.5 sm:px-4 py-3">
                            <Link
                              href={`/stock/${t.ticker}`}
                              onClick={(e) => e.stopPropagation()}
                              className="flex items-center gap-2 font-mono font-semibold text-[var(--text-primary)] hover:text-[var(--accent)]"
                            >
                              <CompanyLogo ticker={t.ticker} logoUrl={t.logo} size={20} />
                              {t.ticker}
                            </Link>
                          </td>
                          <td className="px-2.5 sm:px-4 py-3 text-right font-mono text-[var(--text-secondary)] whitespace-nowrap">
                            {t.shares.toFixed(2)}
                          </td>
                          <td className="px-2.5 sm:px-4 py-3 text-right font-mono text-[var(--text-secondary)] whitespace-nowrap">
                            ${formatPrice(t.price)}
                          </td>
                          <td className="px-2.5 sm:px-4 py-3 text-xs font-mono text-[var(--text-muted)] whitespace-nowrap">
                            {t.reason}
                          </td>
                          <td className="px-2.5 sm:px-4 py-3 text-right text-xs font-mono text-[var(--text-muted)] whitespace-nowrap">
                            {timeAgo(t.timestamp)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </section>

      <Footer />
    </div>
  );
}
