export type Sector =
  | "Technology"
  | "Financials"
  | "Healthcare"
  | "Energy"
  | "Consumer"
  | "Industrials"
  | "Materials"
  | "Utilities"
  | "Real Estate"
  | "Communication";

export interface UniverseEntry {
  ticker: string;
  name: string;
  sector: Sector;
}

// The original hand-picked core. Kept as its own list because the offline
// research (src/research) was run on exactly this set, and the insider-
// trade (SEC Form 4) refresh still only covers it.
export const CORE_UNIVERSE: UniverseEntry[] = [
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
  { ticker: "ABCL", name: "AbCellera Biologics Inc.", sector: "Healthcare" },
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

// Every listed stock that at least one of the tracked fund managers
// (src/lib/investors.ts) holds according to its latest 13F filing and
// that isn't already in the core — so a holding shown on an investor's
// page can also be opened, scored and screened like any other stock here.
// Sectors follow GICS (S&P 500 constituents) or, for the rest, Finnhub's
// industry field mapped by hand. ETFs and bond-style line items are left
// out on purpose: only actual common stocks.
export const INVESTOR_UNIVERSE: UniverseEntry[] = [
  { ticker: "AMAT", name: "Applied Materials", sector: "Technology" },
  { ticker: "CBRS", name: "Cerebras Systems Inc", sector: "Technology" },
  { ticker: "CDW", name: "CDW Corporation", sector: "Technology" },
  { ticker: "CRWV", name: "CoreWeave Inc", sector: "Technology" },
  { ticker: "FTNT", name: "Fortinet", sector: "Technology" },
  { ticker: "GDS", name: "GDS Holdings Ltd", sector: "Technology" },
  { ticker: "GOOG", name: "Alphabet Inc. (Class C)", sector: "Technology" },
  { ticker: "ITRI", name: "Itron Inc", sector: "Technology" },
  { ticker: "LRCX", name: "Lam Research", sector: "Technology" },
  { ticker: "PANW", name: "Palo Alto Networks", sector: "Technology" },
  { ticker: "QCOM", name: "Qualcomm", sector: "Technology" },
  { ticker: "SNDK", name: "Sandisk", sector: "Technology" },
  { ticker: "STM", name: "STMicroelectronics NV", sector: "Technology" },
  { ticker: "TXN", name: "Texas Instruments", sector: "Technology" },
  { ticker: "VRSN", name: "Verisign", sector: "Technology" },
  { ticker: "ALLY", name: "Ally Financial Inc", sector: "Financials" },
  { ticker: "APO", name: "Apollo Global Management", sector: "Financials" },
  { ticker: "AXP", name: "American Express", sector: "Financials" },
  { ticker: "BN", name: "Brookfield Corp", sector: "Financials" },
  { ticker: "CME", name: "CME Group", sector: "Financials" },
  { ticker: "COF", name: "Capital One", sector: "Financials" },
  { ticker: "CPAY", name: "Corpay", sector: "Financials" },
  { ticker: "EWBC", name: "East West Bancorp Inc", sector: "Financials" },
  { ticker: "MCO", name: "Moody's Corporation", sector: "Financials" },
  { ticker: "MSCI", name: "MSCI", sector: "Financials" },
  { ticker: "PS", name: "Pershing Square Inc.", sector: "Financials" },
  { ticker: "PSUS", name: "Pershing Square USA Ltd.", sector: "Financials" },
  { ticker: "SLM", name: "SLM Corp", sector: "Financials" },
  { ticker: "SPGI", name: "S&P Global", sector: "Financials" },
  { ticker: "XYZ", name: "Block, Inc.", sector: "Financials" },
  { ticker: "DHR", name: "Danaher Corporation", sector: "Healthcare" },
  { ticker: "DVA", name: "DaVita", sector: "Healthcare" },
  { ticker: "ELV", name: "Elevance Health", sector: "Healthcare" },
  { ticker: "IDXX", name: "Idexx Laboratories", sector: "Healthcare" },
  { ticker: "INSM", name: "Insmed Inc", sector: "Healthcare" },
  { ticker: "MOH", name: "Molina Healthcare Inc", sector: "Healthcare" },
  { ticker: "NTRA", name: "Natera Inc", sector: "Healthcare" },
  { ticker: "RVMD", name: "Revolution Medicines Inc", sector: "Healthcare" },
  { ticker: "SDGR", name: "Schrodinger Inc", sector: "Healthcare" },
  { ticker: "SYK", name: "Stryker Corporation", sector: "Healthcare" },
  { ticker: "TFX", name: "Teleflex Inc", sector: "Healthcare" },
  { ticker: "VEEV", name: "Veeva Systems", sector: "Healthcare" },
  { ticker: "WAT", name: "Waters Corporation", sector: "Healthcare" },
  { ticker: "WST", name: "West Pharmaceutical Services", sector: "Healthcare" },
  { ticker: "ET", name: "Energy Transfer LP", sector: "Energy" },
  { ticker: "MPLX", name: "MPLX LP", sector: "Energy" },
  { ticker: "OXY", name: "Occidental Petroleum", sector: "Energy" },
  { ticker: "YPF", name: "YPF SA", sector: "Energy" },
  { ticker: "BABA", name: "Alibaba Group Holding Ltd", sector: "Consumer" },
  { ticker: "BUD", name: "Anheuser-Busch Inbev SA", sector: "Consumer" },
  { ticker: "CHD", name: "Church & Dwight", sector: "Consumer" },
  { ticker: "CPNG", name: "Coupang Inc", sector: "Consumer" },
  { ticker: "CROX", name: "Crocs Inc", sector: "Consumer" },
  { ticker: "DHI", name: "D. R. Horton", sector: "Consumer" },
  { ticker: "GPC", name: "Genuine Parts Company", sector: "Consumer" },
  { ticker: "GT", name: "Goodyear Tire & Rubber Co", sector: "Consumer" },
  { ticker: "HD", name: "Home Depot (The)", sector: "Consumer" },
  { ticker: "HRL", name: "Hormel Foods", sector: "Consumer" },
  { ticker: "KHC", name: "Kraft Heinz", sector: "Consumer" },
  { ticker: "KOF", name: "Coca-Cola Femsa SAB de CV", sector: "Consumer" },
  { ticker: "KR", name: "Kroger", sector: "Consumer" },
  { ticker: "LEN", name: "Lennar", sector: "Consumer" },
  { ticker: "LULU", name: "Lululemon Athletica", sector: "Consumer" },
  { ticker: "M", name: "Macy's Inc", sector: "Consumer" },
  { ticker: "MAR", name: "Marriott International", sector: "Consumer" },
  { ticker: "MCD", name: "McDonald's", sector: "Consumer" },
  { ticker: "MELI", name: "MercadoLibre Inc", sector: "Consumer" },
  { ticker: "PDD", name: "PDD Holdings Inc", sector: "Consumer" },
  { ticker: "PM", name: "Philip Morris International", sector: "Consumer" },
  { ticker: "QSR", name: "Restaurant Brands International Inc", sector: "Consumer" },
  { ticker: "SE", name: "Sea Ltd", sector: "Consumer" },
  { ticker: "TJX", name: "TJX Companies", sector: "Consumer" },
  { ticker: "WHR", name: "Whirlpool Corp", sector: "Consumer" },
  { ticker: "YUM", name: "Yum! Brands", sector: "Consumer" },
  { ticker: "AAL", name: "American Airlines Group Inc", sector: "Industrials" },
  { ticker: "ADP", name: "Automatic Data Processing", sector: "Industrials" },
  { ticker: "AERO", name: "Grupo Aeromexico SAB de CV", sector: "Industrials" },
  { ticker: "BA", name: "Boeing", sector: "Industrials" },
  { ticker: "CAT", name: "Caterpillar Inc.", sector: "Industrials" },
  { ticker: "CNI", name: "Canadian National Railway Co", sector: "Industrials" },
  { ticker: "CP", name: "Canadian Pacific Kansas City Ltd", sector: "Industrials" },
  { ticker: "DAL", name: "Delta Air Lines", sector: "Industrials" },
  { ticker: "DE", name: "Deere & Company", sector: "Industrials" },
  { ticker: "DNOW", name: "DNOW Inc", sector: "Industrials" },
  { ticker: "FDX", name: "FedEx", sector: "Industrials" },
  { ticker: "FDXF", name: "FedEx Freight", sector: "Industrials" },
  { ticker: "FERG", name: "Ferguson Enterprises", sector: "Industrials" },
  { ticker: "FLR", name: "Fluor Corp", sector: "Industrials" },
  { ticker: "GE", name: "GE Aerospace", sector: "Industrials" },
  { ticker: "GEV", name: "GE Vernova", sector: "Industrials" },
  { ticker: "HTZ", name: "Hertz Global Holdings Inc", sector: "Industrials" },
  { ticker: "NXT", name: "Nextpower Inc", sector: "Industrials" },
  { ticker: "PCAR", name: "Paccar", sector: "Industrials" },
  { ticker: "UAL", name: "United Airlines Holdings", sector: "Industrials" },
  { ticker: "UBER", name: "Uber", sector: "Industrials" },
  { ticker: "UNP", name: "Union Pacific Corporation", sector: "Industrials" },
  { ticker: "VLTO", name: "Veralto", sector: "Industrials" },
  { ticker: "WCC", name: "Wesco International Inc", sector: "Industrials" },
  { ticker: "WCN", name: "Waste Connections, Inc", sector: "Industrials" },
  { ticker: "WM", name: "Waste Management", sector: "Industrials" },
  { ticker: "ECL", name: "Ecolab", sector: "Materials" },
  { ticker: "EXP", name: "Eagle Materials Inc", sector: "Materials" },
  { ticker: "LPX", name: "Louisiana-Pacific Corp", sector: "Materials" },
  { ticker: "MLM", name: "Martin Marietta Materials", sector: "Materials" },
  { ticker: "NUE", name: "Nucor", sector: "Materials" },
  { ticker: "VMC", name: "Vulcan Materials Company", sector: "Materials" },
  { ticker: "AEP", name: "American Electric Power", sector: "Utilities" },
  { ticker: "ETR", name: "Entergy", sector: "Utilities" },
  { ticker: "NRG", name: "NRG Energy", sector: "Utilities" },
  { ticker: "VST", name: "Vistra Corp.", sector: "Utilities" },
  { ticker: "COLD", name: "Americold Realty Trust Inc", sector: "Real Estate" },
  { ticker: "DLR", name: "Digital Realty", sector: "Real Estate" },
  { ticker: "HHH", name: "Howard Hughes Holdings Inc", sector: "Real Estate" },
  { ticker: "SEG", name: "Seaport Entertainment Group Inc", sector: "Real Estate" },
  { ticker: "APP", name: "AppLovin", sector: "Communication" },
  { ticker: "BIDU", name: "Baidu Inc", sector: "Communication" },
  { ticker: "FOXA", name: "Fox Corporation (Class A)", sector: "Communication" },
  { ticker: "FWONK", name: "Formula One Group (Liberty Media)", sector: "Communication" },
  { ticker: "MSGS", name: "Madison Square Garden Sports Corp", sector: "Communication" },
  { ticker: "NYT", name: "New York Times Co", sector: "Communication" },
  { ticker: "RDDT", name: "Reddit", sector: "Communication" },
  { ticker: "SIRI", name: "Sirius XM Holdings Inc", sector: "Communication" },
  { ticker: "SPCX", name: "Space Exploration Technologies Corp.", sector: "Communication" },
  { ticker: "TKO", name: "TKO Group Holdings", sector: "Communication" },
  { ticker: "TME", name: "Tencent Music Entertainment Group", sector: "Communication" },
  { ticker: "TTWO", name: "Take-Two Interactive", sector: "Communication" },
];

// Prices/scores for these come from the live Finnhub/Yahoo APIs, never
// hardcoded.
export const DEFAULT_UNIVERSE: UniverseEntry[] = [...CORE_UNIVERSE, ...INVESTOR_UNIVERSE];

export const UNIVERSE_MAP = new Map(
  DEFAULT_UNIVERSE.map((e) => [e.ticker, e])
);
