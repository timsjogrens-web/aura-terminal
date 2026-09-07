import { db, setMeta } from "./db";
import { DEFAULT_UNIVERSE, UNIVERSE_MAP } from "./universe";
import { getQuote, getEarningsCalendar, FinnhubError } from "./finnhub";
import { getDailyCandles, YahooError } from "./yahoo";
import { sma, rsi, computeScore } from "./scoring";

const upsertStmt = db.prepare(`
  INSERT INTO quote_cache (
    ticker, company_name, sector, price, change, change_pct, open, high, low,
    prev_close, volume, avg_volume, sma50, rsi14, score, signal, sparkline,
    next_earnings, updated_at, error
  ) VALUES (
    @ticker, @company_name, @sector, @price, @change, @change_pct, @open, @high, @low,
    @prev_close, @volume, @avg_volume, @sma50, @rsi14, @score, @signal, @sparkline,
    @next_earnings, @updated_at, @error
  )
  ON CONFLICT(ticker) DO UPDATE SET
    company_name=excluded.company_name, sector=excluded.sector, price=excluded.price,
    change=excluded.change, change_pct=excluded.change_pct, open=excluded.open,
    high=excluded.high, low=excluded.low, prev_close=excluded.prev_close,
    volume=excluded.volume, avg_volume=excluded.avg_volume, sma50=excluded.sma50,
    rsi14=excluded.rsi14, score=excluded.score, signal=excluded.signal,
    sparkline=excluded.sparkline, next_earnings=excluded.next_earnings,
    updated_at=excluded.updated_at, error=excluded.error
`);

const insertHistoryStmt = db.prepare(`
  INSERT INTO signal_history (ticker, score, signal, price, timestamp)
  VALUES (?, ?, ?, ?, ?)
`);

const errorOnlyStmt = db.prepare(`
  INSERT INTO quote_cache (ticker, error, updated_at)
  VALUES (@ticker, @error, @updated_at)
  ON CONFLICT(ticker) DO UPDATE SET error=excluded.error, updated_at=excluded.updated_at
`);

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

    upsertStmt.run({
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
      updated_at: now,
      error: candleError,
    });

    insertHistoryStmt.run(ticker, breakdown.score, breakdown.signal, quote.c, now);
  } catch (e) {
    const message = e instanceof FinnhubError ? e.message : "Unknown error fetching data.";
    errorOnlyStmt.run({ ticker, error: message, updated_at: now });
  }
}

export async function refreshAll() {
  const watchlistRows = db
    .prepare("SELECT ticker, company_name, sector FROM watchlist")
    .all() as { ticker: string; company_name: string | null; sector: string | null }[];

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
    await new Promise((r) => setTimeout(r, 250)); // stay well under Finnhub's rate limit
  }

  setMeta("last_refresh_at", new Date().toISOString());
}

export function getUniverseTickers(): string[] {
  return DEFAULT_UNIVERSE.map((e) => e.ticker);
}

export { UNIVERSE_MAP };
