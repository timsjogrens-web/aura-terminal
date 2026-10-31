// Finnhub's free tier does not include historical candles for US equities
// (403 on /stock/candle), so daily OHLCV for the scoring indicators comes
// from Yahoo Finance's public chart endpoint instead — free, no key, real
// live/historical data (never mocked).

export class YahooError extends Error {}

interface YahooChartResponse {
  chart: {
    result: Array<{
      timestamp: number[];
      indicators: {
        quote: Array<{
          close: (number | null)[];
          open: (number | null)[];
          high: (number | null)[];
          low: (number | null)[];
          volume: (number | null)[];
        }>;
        adjclose?: Array<{ adjclose: (number | null)[] }>;
      };
    }> | null;
    error: { code: string; description: string } | null;
  };
}

export interface DailyCandles {
  closes: number[]; // raw close — the actual quoted market price
  adjCloses: number[]; // dividend-adjusted close — for indicators/returns, so a stock isn't penalized for paying a dividend
  opens: number[]; // raw open — for modeling next-day-open execution instead of same-day-close
  volumes: number[];
  timestamps: number[]; // unix seconds, same length/order as closes
}

export interface ChartSeries {
  timestamps: number[]; // unix seconds
  closes: number[];
  opens?: number[]; // present when the caller requested OHLC (getChartSeries) — for candlestick rendering
  highs?: number[];
  lows?: number[];
}

async function fetchYahooChart(
  symbol: string,
  range: string,
  interval: string
): Promise<{
  timestamp: number[];
  quote: {
    close: (number | null)[];
    open: (number | null)[];
    high: (number | null)[];
    low: (number | null)[];
    volume: (number | null)[];
  };
  adjclose: (number | null)[] | null;
}> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    symbol
  )}?range=${range}&interval=${interval}`;

  let res: Response;
  try {
    res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; CandorApp/1.0)" },
      cache: "no-store",
    });
  } catch (e) {
    throw new YahooError(`Network error fetching historical data: ${(e as Error).message}`);
  }

  if (!res.ok) {
    throw new YahooError(`Historical data request failed: ${res.status} ${res.statusText}`);
  }

  const json = (await res.json()) as YahooChartResponse;
  if (json.chart.error) {
    throw new YahooError(`Historical data unavailable for ${symbol}: ${json.chart.error.description}`);
  }
  const result = json.chart.result?.[0];
  if (!result) {
    throw new YahooError(`No historical data returned for ${symbol}.`);
  }
  return {
    timestamp: result.timestamp,
    quote: result.indicators.quote[0],
    adjclose: result.indicators.adjclose?.[0]?.adjclose ?? null,
  };
}

export async function getDailyCandles(symbol: string, range = "6mo"): Promise<DailyCandles> {
  const { timestamp, quote, adjclose } = await fetchYahooChart(symbol, range, "1d");
  const closes: number[] = [];
  const adjCloses: number[] = [];
  const opens: number[] = [];
  const volumes: number[] = [];
  const timestamps: number[] = [];
  for (let i = 0; i < timestamp.length; i++) {
    const c = quote.close[i];
    const o = quote.open[i];
    const v = quote.volume[i];
    if (c !== null && c !== undefined) {
      closes.push(c);
      // Yahoo omits the adjclose series entirely for some symbols (e.g.
      // indices like SPY behave fine, but fall back to raw close rather
      // than silently misaligning arrays if it's ever missing).
      adjCloses.push(adjclose?.[i] ?? c);
      opens.push(o ?? c);
      volumes.push(v ?? 0);
      timestamps.push(timestamp[i]);
    }
  }

  if (closes.length < 2) {
    throw new YahooError(`Not enough historical data points for ${symbol}.`);
  }

  return { closes, adjCloses, opens, volumes, timestamps };
}

const RANGE_PRESETS: Record<string, { range: string; interval: string }> = {
  "1D": { range: "1d", interval: "5m" },
  "1W": { range: "5d", interval: "15m" },
  "1M": { range: "1mo", interval: "1d" },
  "3M": { range: "3mo", interval: "1d" },
  "6M": { range: "6mo", interval: "1d" },
  YTD: { range: "ytd", interval: "1d" },
  "1Y": { range: "1y", interval: "1d" },
  "3Y": { range: "3y", interval: "1wk" },
  "5Y": { range: "5y", interval: "1wk" },
  MAX: { range: "max", interval: "1mo" },
};

export function isValidChartRange(range: string): boolean {
  return range in RANGE_PRESETS;
}

export async function getChartSeries(symbol: string, rangeKey: string): Promise<ChartSeries> {
  const preset = RANGE_PRESETS[rangeKey];
  if (!preset) throw new YahooError(`Unsupported chart range: ${rangeKey}`);

  const { timestamp, quote } = await fetchYahooChart(symbol, preset.range, preset.interval);
  const timestamps: number[] = [];
  const closes: number[] = [];
  const opens: number[] = [];
  const highs: number[] = [];
  const lows: number[] = [];
  for (let i = 0; i < timestamp.length; i++) {
    const c = quote.close[i];
    // A candle needs all four OHLC values — Yahoo occasionally has a null
    // open/high/low on a bar even when close is present (illiquid ticks),
    // so skip the whole bar rather than draw a candle with fabricated
    // values for the missing side.
    const o = quote.open[i];
    const h = quote.high[i];
    const l = quote.low[i];
    if (c !== null && c !== undefined && o !== null && o !== undefined && h !== null && h !== undefined && l !== null && l !== undefined) {
      timestamps.push(timestamp[i]);
      closes.push(c);
      opens.push(o);
      highs.push(h);
      lows.push(l);
    }
  }

  if (closes.length < 2) {
    throw new YahooError(`Not enough chart data for ${symbol} at range ${rangeKey}.`);
  }

  return { timestamps, closes, opens, highs, lows };
}

// For honest performance comparisons (backtests, paper portfolio vs. index)
// — not for the visual price chart, which intentionally shows the real
// quoted price. adjclose bakes dividends into the price series (the
// standard total-return convention), so a return computed from it already
// includes reinvested dividends without a separate dividend-history fetch.
export async function getTotalReturnSeries(symbol: string, rangeKey: string): Promise<ChartSeries> {
  const preset = RANGE_PRESETS[rangeKey];
  if (!preset) throw new YahooError(`Unsupported chart range: ${rangeKey}`);
  return getTotalReturnSeriesRaw(symbol, preset.range, preset.interval);
}

// Same as getTotalReturnSeries, but takes raw Yahoo range/interval strings
// instead of one of the app's display presets — used by the offline
// research scripts (src/research/), which need longer history and monthly
// bars that RANGE_PRESETS doesn't expose (e.g. "10y" / "1mo").
export async function getTotalReturnSeriesRaw(
  symbol: string,
  range: string,
  interval: string
): Promise<ChartSeries> {
  const { timestamp, quote, adjclose } = await fetchYahooChart(symbol, range, interval);
  const timestamps: number[] = [];
  const closes: number[] = [];
  for (let i = 0; i < timestamp.length; i++) {
    const c = quote.close[i];
    if (c !== null && c !== undefined) {
      timestamps.push(timestamp[i]);
      closes.push(adjclose?.[i] ?? c);
    }
  }

  if (closes.length < 2) {
    throw new YahooError(`Not enough chart data for ${symbol} at range ${range}.`);
  }

  return { timestamps, closes };
}
