export interface Quote {
  ticker: string;
  company_name: string | null;
  sector: string | null;
  price: number | null;
  change: number | null;
  change_pct: number | null;
  open: number | null;
  high: number | null;
  low: number | null;
  prev_close: number | null;
  volume: number | null;
  avg_volume: number | null;
  sma50: number | null;
  rsi14: number | null;
  score: number | null;
  signal: string | null;
  sparkline: number[];
  next_earnings: string | null;
  news: NewsItem[];
  updated_at: string | null;
  error: string | null;
}

export interface NewsItem {
  headline: string;
  url: string;
  source: string;
  datetime: number;
}

export interface QuotesResponse {
  quotes: Quote[];
  lastRefresh: string | null;
  isStale: boolean;
  staleThresholdMinutes: number;
  apiKeyConfigured: boolean;
}
