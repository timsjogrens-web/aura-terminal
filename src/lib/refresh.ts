import { db, setMeta } from "./db";
import { DEFAULT_UNIVERSE, UNIVERSE_MAP } from "./universe";
import { getQuote, getEarningsCalendar, getCompanyNews, getProfile, FinnhubError } from "./finnhub";
import { getDailyCandles, YahooError } from "./yahoo";
import { filterRelevantNews } from "./newsFilter";
import { sma, rsi, computeScore } from "./scoring";
import { maybeTrade, checkRiskExits } from "./paperTrading";
import { sendStrongBuyAlert } from "./discordAlert";

const UPSERT_SQL = `
  INSERT INTO quote_cache (
    ticker, company_name, sector, price, change, change_pct, open, high, low,
    prev_close, volume, avg_volume, sma50, rsi14, score, signal, sparkline,
    next_earnings, news, logo, updated_at, error
  ) VALUES (
    :ticker, :company_name, :sector, :price, :change, :change_pct, :open, :high, :low,
    :prev_close, :volume, :avg_volume, :sma50, :rsi14, :score, :signal, :sparkline,
    :next_earnings, :news, :logo, :updated_at, :error
  )
  ON CONFLICT(ticker) DO UPDATE SET
    company_name=excluded.company_name, sector=excluded.sector, price=excluded.price,
    change=excluded.change, change_pct=excluded.change_pct, open=excluded.open,
    high=excluded.high, low=excluded.low, prev_close=excluded.prev_close,
    volume=excluded.volume, avg_volume=excluded.avg_volume, sma50=excluded.sma50,
    rsi14=excluded.rsi14, score=excluded.score, signal=excluded.signal,
    sparkline=excluded.sparkline, next_earnings=excluded.next_earnings,
    news=excluded.news, logo=excluded.logo, updated_at=excluded.updated_at, error=excluded.error
`;

const EXISTING_LOGO_SQL = `SELECT logo FROM quote_cache WHERE ticker = ?`;

const INSERT_HISTORY_SQL = `
  INSERT INTO signal_history (ticker, score, signal, price, timestamp)
  VALUES (?, ?, ?, ?, ?)
`;

const LATEST_HISTORY_SQL = `
  SELECT signal FROM signal_history WHERE ticker = ? ORDER BY id DESC LIMIT 1
`;

const ERROR_ONLY_SQL = `
  INSERT INTO quote_cache (ticker, error, updated_at)
  VALUES (:ticker, :error, :updated_at)
  ON CONFLICT(ticker) DO UPDATE SET error=excluded.error, updated_at=excluded.updated_at
`;

export async function refreshOne(ticker: string, name: string, sector: string) {
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
      sma50 = sma(candles.closes, 50);
      rsi14 = rsi(candles.closes, 14);
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

    // Logos don't change, so this is fetched once and reused from the
    // cache forever after rather than re-hitting Finnhub's profile
    // endpoint on every refresh cycle.
    let logo: string | null = null;
    const existingLogoRes = await db.execute({ sql: EXISTING_LOGO_SQL, args: [ticker] });
    logo = (existingLogoRes.rows[0] as { logo: string | null } | undefined)?.logo ?? null;
    if (!logo) {
      try {
        const profile = await getProfile(ticker);
        logo = profile.logo || null;
      } catch {
        logo = null;
      }
    }

    let nextEarnings: string | null = null;
    try {
      const from = new Date().toISOString().slice(0, 10);
      const to = new Date(Date.now() + 120 * 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10);
      const earnings = await getEarningsCalendar(ticker, from, to);
      if (earnings.length > 0) {
        nextEarnings = earnings.sort((a, b) => a.date.localeCompare(b.date))[0].date;
      }
    } catch {
      nextEarnings = null;
    }

    let news: { headline: string; url: string; source: string; datetime: number }[] = [];
    try {
      const from = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const to = new Date().toISOString().slice(0, 10);
      const items = await getCompanyNews(ticker, from, to);
      news = filterRelevantNews(items, name)
        .sort((a, b) => b.datetime - a.datetime)
        .slice(0, 3)
        .map((n) => ({ headline: n.headline, url: n.url, source: n.source, datetime: n.datetime }));
    } catch {
      news = [];
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
        news: JSON.stringify(news),
        logo,
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
      await maybeTrade(ticker, breakdown.signal, quote.c, now);
      if (breakdown.signal === "STRONG BUY") {
        await sendStrongBuyAlert(ticker, quote.c, breakdown.score);
      }
    }

    // Stop-loss/trailing-stop react to price, not to the score, so this
    // runs every cycle rather than only on a signal transition.
    await checkRiskExits(ticker, quote.c, now);
  } catch (e) {
    const message = e instanceof FinnhubError ? e.message : "Unknown error fetching data.";
    await db.execute({ sql: ERROR_ONLY_SQL, args: { ticker, error: message, updated_at: now } });
  }
}

export async function refreshAll() {
  const watchlistRes = await db.execute("SELECT ticker, company_name, sector FROM watchlist");
  const watchlistRows = watchlistRes.rows as unknown as {
    ticker: string;
    company_name: string | null;
    sector: string | null;
  }[];

  const targets = new Map<string, { name: string; sector: string }>();
  for (const e of DEFAULT_UNIVERSE) targets.set(e.ticker, { name: e.name, sector: e.sector });
  for (const w of watchlistRows) {
    if (!targets.has(w.ticker)) {
      targets.set(w.ticker, {
        name: w.company_name ?? w.ticker,
        sector: w.sector ?? "Watchlist",
      });
    }
  }

  for (const [ticker, meta] of targets) {
    await refreshOne(ticker, meta.name, meta.sector);
    await new Promise((r) => setTimeout(r, 350)); // stay well under Finnhub's rate limit
  }

  await setMeta("last_refresh_at", new Date().toISOString());
}

export function getUniverseTickers(): string[] {
  return DEFAULT_UNIVERSE.map((e) => e.ticker);
}

export { UNIVERSE_MAP };
