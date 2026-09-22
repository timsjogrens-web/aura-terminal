import { db, getMeta, setMeta } from "./db";
import { DEFAULT_UNIVERSE, UNIVERSE_MAP } from "./universe";
import { getQuote, getEarningsCalendar, getCompanyNews, getProfile, FinnhubError } from "./finnhub";
import { getDailyCandles, YahooError } from "./yahoo";
import { filterRelevantNews } from "./newsFilter";
import { sma, rsi, computeScore } from "./scoring";
import { maybeTrade, checkRiskExitsForTicker } from "./paperTrading";
import { getBotEnabledUserIds } from "./users";
import { sendStrongBuyAlert } from "./discordAlert";
import { appendSignalToLedger } from "./ledger";

const UPSERT_SQL = `
  INSERT INTO quote_cache (
    ticker, company_name, sector, price, change, change_pct, open, high, low,
    prev_close, volume, avg_volume, sma50, rsi14, score, signal, sparkline,
    next_earnings, news, logo, aux_fetched_at, updated_at, error
  ) VALUES (
    :ticker, :company_name, :sector, :price, :change, :change_pct, :open, :high, :low,
    :prev_close, :volume, :avg_volume, :sma50, :rsi14, :score, :signal, :sparkline,
    :next_earnings, :news, :logo, :aux_fetched_at, :updated_at, :error
  )
  ON CONFLICT(ticker) DO UPDATE SET
    company_name=excluded.company_name, sector=excluded.sector, price=excluded.price,
    change=excluded.change, change_pct=excluded.change_pct, open=excluded.open,
    high=excluded.high, low=excluded.low, prev_close=excluded.prev_close,
    volume=excluded.volume, avg_volume=excluded.avg_volume, sma50=excluded.sma50,
    rsi14=excluded.rsi14, score=excluded.score, signal=excluded.signal,
    sparkline=excluded.sparkline, next_earnings=excluded.next_earnings,
    news=excluded.news, logo=excluded.logo, aux_fetched_at=excluded.aux_fetched_at,
    updated_at=excluded.updated_at, error=excluded.error
`;

const EXISTING_SQL = `SELECT logo, news, next_earnings, aux_fetched_at FROM quote_cache WHERE ticker = ?`;

const INSERT_HISTORY_SQL = `
  INSERT INTO signal_history (ticker, score, signal, price, timestamp)
  VALUES (?, ?, ?, ?, ?)
`;

const LATEST_HISTORY_SQL = `
  SELECT signal FROM signal_history WHERE ticker = ? ORDER BY id DESC LIMIT 1
`;

// Name/sector are written on first insert too, so a stock Finnhub can't
// price still shows up labelled in the screener instead of as a blank row.
const ERROR_ONLY_SQL = `
  INSERT INTO quote_cache (ticker, company_name, sector, error, updated_at)
  VALUES (:ticker, :company_name, :sector, :error, :updated_at)
  ON CONFLICT(ticker) DO UPDATE SET error=excluded.error, updated_at=excluded.updated_at
`;

// News, the next earnings date and the logo change slowly, and each costs a
// Finnhub call (the scarce resource with ~170 stocks on a 60-calls/minute
// free tier) — so they're refetched at most this often, while price and
// score still update on every pass.
const AUX_TTL_MS = 6 * 60 * 60 * 1000;

// One invocation refreshes as many of the stalest stocks as fit in this
// window, then stops — a serverless function can't walk the whole universe
// in one go. Later invocations continue where this one left off.
const BATCH_BUDGET_MS = 45_000;

const LOCK_KEY = "refresh_lock_at";
const LOCK_MS = 5 * 60 * 1000;

export interface RefreshTarget {
  ticker: string;
  name: string;
  sector: string;
}

// Never-fetched stocks first, then oldest-updated first. Ties keep the
// universe's own order so the result is deterministic.
export function orderByStalest(
  targets: RefreshTarget[],
  updatedAt: Map<string, string | null>
): RefreshTarget[] {
  const ts = (ticker: string) => {
    const v = updatedAt.get(ticker);
    return v ? new Date(v).getTime() : -Infinity;
  };
  return targets
    .map((t, i) => ({ t, i }))
    .sort((a, b) => {
      const ta = ts(a.t.ticker);
      const tb = ts(b.t.ticker);
      if (ta === tb) return a.i - b.i;
      return ta < tb ? -1 : 1;
    })
    .map((x) => x.t);
}

export function isAuxDue(auxFetchedAt: string | null, nowMs: number): boolean {
  if (!auxFetchedAt) return true;
  const t = new Date(auxFetchedAt).getTime();
  return Number.isNaN(t) || nowMs - t > AUX_TTL_MS;
}

export async function refreshOne(ticker: string, name: string, sector: string, botEnabledUserIds: number[] = []) {
  const now = new Date().toISOString();
  try {
    const quote = await getQuote(ticker);

    let sma50: number | null = null;
    let rsi14: number | null = null;
    let avgVolume: number | null = null;
    let latestVolume: number | null = null;
    let sparkline: number[] = [];
    let candleError: string | null = null;

    try {
      const candles = await getDailyCandles(ticker, "6mo");
      sma50 = sma(candles.adjCloses, 50);
      rsi14 = rsi(candles.adjCloses, 14);
      // Compare the most recent session's volume against the prior 20-day average.
      latestVolume = candles.volumes[candles.volumes.length - 1] ?? null;
      const priorVolumes = candles.volumes.slice(-21, -1);
      avgVolume =
        priorVolumes.length > 0
          ? priorVolumes.reduce((a, b) => a + b, 0) / priorVolumes.length
          : null;
      sparkline = candles.closes.slice(-30);
    } catch (e) {
      candleError =
        e instanceof YahooError ? e.message : "Historical candle data unavailable.";
    }

    const breakdown = computeScore({
      price: quote.c,
      sma50,
      rsi14,
      volume: latestVolume,
      avgVolume,
    });

    // Logo, earnings date and news come from the row we already have unless
    // they're due for a refresh (see AUX_TTL_MS). A failed fetch keeps the
    // old value rather than wiping it.
    const existingRes = await db.execute({ sql: EXISTING_SQL, args: [ticker] });
    const existing = existingRes.rows[0] as
      | { logo: string | null; news: string | null; next_earnings: string | null; aux_fetched_at: string | null }
      | undefined;
    let logo: string | null = existing?.logo ?? null;
    let nextEarnings: string | null = existing?.next_earnings ?? null;
    let newsJson: string = existing?.news ?? "[]";
    let auxFetchedAt: string | null = existing?.aux_fetched_at ?? null;

    if (isAuxDue(auxFetchedAt, Date.now())) {
      let anyOk = false;

      if (!logo) {
        try {
          const profile = await getProfile(ticker);
          logo = profile.logo || null;
          anyOk = true;
        } catch {
          // keep null; retried on the next due refresh
        }
      }

      try {
        const from = new Date().toISOString().slice(0, 10);
        const to = new Date(Date.now() + 120 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        const earnings = await getEarningsCalendar(ticker, from, to);
        nextEarnings =
          earnings.length > 0 ? earnings.sort((a, b) => a.date.localeCompare(b.date))[0].date : null;
        anyOk = true;
      } catch {
        // keep the previous value
      }

      try {
        const from = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        const to = new Date().toISOString().slice(0, 10);
        const items = await getCompanyNews(ticker, from, to);
        newsJson = JSON.stringify(
          filterRelevantNews(items, name)
            .sort((a, b) => b.datetime - a.datetime)
            .slice(0, 3)
            .map((n) => ({ headline: n.headline, url: n.url, source: n.source, datetime: n.datetime }))
        );
        anyOk = true;
      } catch {
        // keep the previous value
      }

      if (anyOk) auxFetchedAt = now;
    }

    await db.execute({
      sql: UPSERT_SQL,
      args: {
        ticker,
        company_name: name,
        sector,
        price: quote.c,
        change: quote.d,
        change_pct: quote.dp,
        open: quote.o,
        high: quote.h,
        low: quote.l,
        prev_close: quote.pc,
        volume: latestVolume,
        avg_volume: avgVolume,
        sma50,
        rsi14,
        score: breakdown.score,
        signal: breakdown.signal,
        sparkline: JSON.stringify(sparkline),
        next_earnings: nextEarnings,
        news: newsJson,
        logo,
        aux_fetched_at: auxFetchedAt,
        updated_at: now,
        error: candleError,
      },
    });

    // Only log a new history row when the signal actually changed. Logging
    // every refresh cycle unconditionally meant a stock sitting at STRONG
    // BUY for hours produced dozens of near-identical rows — a wall of
    // overlapping dots on the chart and an inflated, misleading "calls
    // evaluated" count, all really just one continuous call.
    const latestRes = await db.execute({ sql: LATEST_HISTORY_SQL, args: [ticker] });
    const latestSignal = (latestRes.rows[0] as { signal: string } | undefined)?.signal ?? null;
    if (latestSignal !== breakdown.signal) {
      await db.execute({
        sql: INSERT_HISTORY_SQL,
        args: [ticker, breakdown.score, breakdown.signal, quote.c, now],
      });
      // Tamper-evident, append-only record of the same signal — separate
      // from signal_history above (which stays as-is for existing
      // readers), see src/lib/ledger.ts for what this protects against.
      await appendSignalToLedger({ ticker, score: breakdown.score, signal: breakdown.signal, price: quote.c, timestamp: now });
      // The very first time a stock is seen isn't a signal CHANGE, just its
      // starting state — it's recorded above, but doesn't trigger a paper
      // trade or a Discord alert. Otherwise adding a batch of stocks to the
      // universe would fire a burst of alerts and buys for stocks that were
      // already sitting at BUY/STRONG BUY.
      if (latestSignal !== null) {
        // Once per user who has the bot switched on — each trades their
        // own account independently, starting from their own $100k.
        for (const userId of botEnabledUserIds) {
          await maybeTrade(userId, ticker, breakdown.signal, quote.c, now);
        }
        if (breakdown.signal === "STRONG BUY") {
          await sendStrongBuyAlert(ticker, quote.c, breakdown.score);
        }
      }
    }

    // Stop-loss/trailing-stop react to price, not to the score, so this
    // runs every cycle rather than only on a signal transition — for every
    // user who currently holds this ticker via the bot, whether or not
    // they've since switched it off (an existing position still gets
    // managed until it closes).
    await checkRiskExitsForTicker(ticker, quote.c, now);
  } catch (e) {
    const message = e instanceof FinnhubError ? e.message : "Unknown error fetching data.";
    await db.execute({
      sql: ERROR_ONLY_SQL,
      args: { ticker, company_name: name, sector, error: message, updated_at: now },
    });
  }
}

export async function loadTargets(): Promise<RefreshTarget[]> {
  const watchlistRes = await db.execute("SELECT ticker, company_name, sector FROM watchlist");
  const watchlistRows = watchlistRes.rows as unknown as {
    ticker: string;
    company_name: string | null;
    sector: string | null;
  }[];

  const targets = new Map<string, RefreshTarget>();
  for (const e of DEFAULT_UNIVERSE) targets.set(e.ticker, { ticker: e.ticker, name: e.name, sector: e.sector });
  for (const w of watchlistRows) {
    if (!targets.has(w.ticker)) {
      targets.set(w.ticker, {
        ticker: w.ticker,
        name: w.company_name ?? w.ticker,
        sector: w.sector ?? "Watchlist",
      });
    }
  }
  return Array.from(targets.values());
}

// The lock also stops a second run starting on top of this one: refreshOne
// appends to the hash-chained signal ledger and moves paper-trading cash
// around, and neither is safe to run concurrently.
//
// This used to be read-then-write (read the lock, check its age, then
// write a fresh one) — exactly the same non-atomic shape that forced the
// ledger's CAS fix (see ledger.ts), and it had the same failure mode: two
// overlapping requests (e.g. the cron trigger firing right as someone
// clicked "Uppdatera nu") could both read an expired lock before either
// wrote a fresh one, and both proceed to run refreshAll() at once. That's
// exactly what caused a real duplicate ANET buy on 2026-09-18 — two
// concurrent runs both saw "no open position" before either had recorded
// its trade, and both bought.
//
// Fixed the same way as the ledger: write MY OWN unique token with a
// single conditional UPDATE (only takes effect if the stored value is
// still missing/expired at the instant SQLite applies it, not at the
// instant I last read it), then read the value back — if it's my token,
// I won the lock; if it's someone else's, they got there first.
async function acquireLock(): Promise<boolean> {
  const myToken = `${new Date().toISOString()}-${Math.random().toString(36).slice(2, 8)}`;
  const cutoffIso = new Date(Date.now() - LOCK_MS).toISOString();

  await db.execute({
    sql: `
      INSERT INTO meta (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
      WHERE meta.value IS NULL OR meta.value = '' OR meta.value < ?
    `,
    args: [LOCK_KEY, myToken, cutoffIso],
  });

  const current = await getMeta(LOCK_KEY);
  return current === myToken;
}

// Refreshes the stalest stocks that fit in one time budget — with ~170
// stocks that's a slice of the universe per call, not all of it. Whoever
// calls this (cron, the refresh button, a page view noticing stale data)
// just moves the whole set a bit further along.
export async function refreshAll(): Promise<{ refreshed: number; total: number; skipped: boolean }> {
  if (!(await acquireLock())) return { refreshed: 0, total: 0, skipped: true };
  try {
    const targets = await loadTargets();
    const ageRes = await db.execute("SELECT ticker, updated_at FROM quote_cache");
    const updatedAt = new Map(
      (ageRes.rows as unknown as { ticker: string; updated_at: string | null }[]).map((r) => [r.ticker, r.updated_at])
    );
    // Fetched once per batch (not per ticker) — who has the bot on doesn't
    // change mid-batch, and this is the only extra query multi-user trading
    // adds to the hot loop.
    const botEnabledUserIds = await getBotEnabledUserIds();

    const started = Date.now();
    let refreshed = 0;
    for (const t of orderByStalest(targets, updatedAt)) {
      if (Date.now() - started > BATCH_BUDGET_MS) break;
      await refreshOne(t.ticker, t.name, t.sector, botEnabledUserIds);
      refreshed++;
    }

    await setMeta("last_refresh_at", new Date().toISOString());
    return { refreshed, total: targets.length, skipped: false };
  } finally {
    await setMeta(LOCK_KEY, "");
  }
}

export function getUniverseTickers(): string[] {
  return DEFAULT_UNIVERSE.map((e) => e.ticker);
}

export { UNIVERSE_MAP };
