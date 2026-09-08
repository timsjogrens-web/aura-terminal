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
          volume: (number | null)[];
        }>;
      };
    }> | null;
    error: { code: string; description: string } | null;
  };
}

export interface DailyCandles {
  closes: number[];
  volumes: number[];
}

export interface ChartSeries {
  timestamps: number[]; // unix seconds
  closes: number[];
}

async function fetchYahooChart(
  symbol: string,
  range: string,
  interval: string
): Promise<{ timestamp: number[]; quote: { close: (number | null)[]; volume: (number | null)[] } }> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    symbol
  )}?range=${range}&interval=${interval}`;

  let res: Response;
  try {
    res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; AuraTerminal/1.0)" },
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
  return { timestamp: result.timestamp, quote: result.indicators.quote[0] };
}

export async function getDailyCandles(symbol: string, range = "6mo"): Promise<DailyCandles> {
  const { timestamp, quote } = await fetchYahooChart(symbol, range, "1d");
  const closes: number[] = [];
  const volumes: number[] = [];
  for (let i = 0; i < timestamp.length; i++) {
    const c = quote.close[i];
    const v = quote.volume[i];
    if (c !== null && c !== undefined) {
      closes.push(c);
      volumes.push(v ?? 0);
    }
  }

  if (closes.length < 2) {
    throw new YahooError(`Not enough historical data points for ${symbol}.`);
  }

  return { closes, volumes };
}

const RANGE_PRESETS: Record<string, { range: string; interval: string }> = {
  "1D": { range: "1d", interval: "5m" },
  "1W": { range: "5d", interval: "15m" },
  "1M": { range: "1mo", interval: "1d" },
  "6M": { range: "6mo", interval: "1d" },
  "1Y": { range: "1y", interval: "1d" },
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
  for (let i = 0; i < timestamp.length; i++) {
    const c = quote.close[i];
    if (c !== null && c !== undefined) {
      timestamps.push(timestamp[i]);
      closes.push(c);
    }
  }

  if (closes.length < 2) {
    throw new YahooError(`Not enough chart data for ${symbol} at range ${rangeKey}.`);
  }

  return { timestamps, closes };
}
