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

export async function getDailyCandles(symbol: string, range = "6mo"): Promise<DailyCandles> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    symbol
  )}?range=${range}&interval=1d`;

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

  const quote = result.indicators.quote[0];
  const closes: number[] = [];
  const volumes: number[] = [];
  for (let i = 0; i < result.timestamp.length; i++) {
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
