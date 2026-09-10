export type Sector =
  | "Technology"
  | "Financials"
  | "Healthcare"
  | "Energy"
  | "Consumer";

export interface UniverseEntry {
  ticker: string;
  name: string;
  sector: Sector;
}

// The US equities tracked by default. Real, publicly traded symbols —
// prices/scores for these come from the live Finnhub API, never hardcoded.
export const DEFAULT_UNIVERSE: UniverseEntry[] = [
  { ticker: "AAPL", name: "Apple Inc.", sector: "Technology" },
  { ticker: "MSFT", name: "Microsoft Corporation", sector: "Technology" },
  { ticker: "GOOGL", name: "Alphabet Inc.", sector: "Technology" },
  { ticker: "NVDA", name: "NVIDIA Corporation", sector: "Technology" },
  { ticker: "AMD", name: "Advanced Micro Devices", sector: "Technology" },
  { ticker: "META", name: "Meta Platforms, Inc.", sector: "Technology" },
  { ticker: "CRM", name: "Salesforce, Inc.", sector: "Technology" },
  { ticker: "ORCL", name: "Oracle Corporation", sector: "Technology" },
  { ticker: "ADBE", name: "Adobe Inc.", sector: "Technology" },
  { ticker: "AVGO", name: "Broadcom Inc.", sector: "Technology" },
  { ticker: "TSM", name: "Taiwan Semiconductor Manufacturing", sector: "Technology" },
  { ticker: "MU", name: "Micron Technology, Inc.", sector: "Technology" },
  { ticker: "ARM", name: "Arm Holdings plc", sector: "Technology" },
  { ticker: "INTC", name: "Intel Corporation", sector: "Technology" },
  { ticker: "PLTR", name: "Palantir Technologies Inc.", sector: "Technology" },
  { ticker: "SNOW", name: "Snowflake Inc.", sector: "Technology" },
  { ticker: "DELL", name: "Dell Technologies Inc.", sector: "Technology" },
  { ticker: "ANET", name: "Arista Networks, Inc.", sector: "Technology" },
  { ticker: "VRT", name: "Vertiv Holdings Co.", sector: "Technology" },
  { ticker: "JPM", name: "JPMorgan Chase & Co.", sector: "Financials" },
  { ticker: "BAC", name: "Bank of America Corp.", sector: "Financials" },
  { ticker: "GS", name: "The Goldman Sachs Group", sector: "Financials" },
  { ticker: "V", name: "Visa Inc.", sector: "Financials" },
  { ticker: "MA", name: "Mastercard Incorporated", sector: "Financials" },
  { ticker: "LLY", name: "Eli Lilly and Company", sector: "Healthcare" },
  { ticker: "PFE", name: "Pfizer Inc.", sector: "Healthcare" },
  { ticker: "UNH", name: "UnitedHealth Group Inc.", sector: "Healthcare" },
  { ticker: "JNJ", name: "Johnson & Johnson", sector: "Healthcare" },
  { ticker: "ABBV", name: "AbbVie Inc.", sector: "Healthcare" },
  { ticker: "XOM", name: "Exxon Mobil Corporation", sector: "Energy" },
  { ticker: "CVX", name: "Chevron Corporation", sector: "Energy" },
  { ticker: "COP", name: "ConocoPhillips", sector: "Energy" },
  { ticker: "AMZN", name: "Amazon.com, Inc.", sector: "Consumer" },
  { ticker: "TSLA", name: "Tesla, Inc.", sector: "Consumer" },
  { ticker: "PG", name: "Procter & Gamble Co.", sector: "Consumer" },
  { ticker: "KO", name: "The Coca-Cola Company", sector: "Consumer" },
  { ticker: "WMT", name: "Walmart Inc.", sector: "Consumer" },
  { ticker: "NFLX", name: "Netflix, Inc.", sector: "Consumer" },
  { ticker: "DIS", name: "The Walt Disney Company", sector: "Consumer" },
  { ticker: "NKE", name: "NIKE, Inc.", sector: "Consumer" },
];

export const UNIVERSE_MAP = new Map(
  DEFAULT_UNIVERSE.map((e) => [e.ticker, e])
);
