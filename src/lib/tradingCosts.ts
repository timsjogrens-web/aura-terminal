// Cost assumptions for a Swedish private investor trading US stocks through
// an ISK at a broker like Avanza or Nordnet. These are round, commonly-cited
// defaults, NOT independently verified against a live, current price list —
// check them against your own broker's actual terms before trusting any
// backtest number that depends on them. Every figure here is deliberately
// isolated in one file so it's easy to correct.
export const TRADING_COSTS = {
  // Brokerage commission. Many Swedish brokers now offer commission-free or
  // near-zero US trading with the cost folded into the FX spread instead —
  // 0 is a defensible default for that reason, but raise this if your
  // broker charges a separate courtage.
  commissionPct: 0,
  commissionMinSek: 0,

  // Currency conversion, charged once converting SEK->USD to buy and again
  // USD->SEK to sell — so a round trip pays this twice. ~0.25% is the
  // figure most often quoted for Avanza/Nordnet's standard (non-currency-
  // account) conversion; some accounts get a better rate.
  fxFeePctPerConversion: 0.25,

  // Slippage: the gap between the signal's reference price and what you
  // actually pay, from bid-ask spread and price impact. Tiered by dollar
  // trading volume as a liquidity proxy — everything in the default
  // tracked universe is large/mega-cap US stock, so this will mostly
  // resolve to the "liquid" tier today, but the tiering exists so it
  // degrades sensibly if smaller names are ever added.
  slippageTiersBps: [
    { minDollarADV: 1_000_000_000, bps: 5 }, // >$1B/day traded: very liquid
    { minDollarADV: 100_000_000, bps: 10 }, // $100M-$1B/day
    { minDollarADV: 0, bps: 25 }, // below that
  ],
};

export function slippageBps(dollarADV: number | null): number {
  if (dollarADV === null) return TRADING_COSTS.slippageTiersBps.at(-1)!.bps; // unknown liquidity -> worst case
  for (const tier of TRADING_COSTS.slippageTiersBps) {
    if (dollarADV >= tier.minDollarADV) return tier.bps;
  }
  return TRADING_COSTS.slippageTiersBps.at(-1)!.bps;
}

// Round-trip cost fraction (buy + sell) as a decimal, e.g. 0.011 = 1.1%.
// Applied to BOTH legs of a trade — a position that never gets a real edge
// this large will lose money to costs alone, which is the entire point of
// modeling it rather than reporting a costless paper return.
export function oneWayCostFraction(dollarADV: number | null): number {
  const commission = TRADING_COSTS.commissionPct / 100;
  const fx = TRADING_COSTS.fxFeePctPerConversion / 100;
  const slippage = slippageBps(dollarADV) / 10_000;
  return commission + fx + slippage;
}
