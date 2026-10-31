// Answers a different question from the exit-rule sweep: not "is there a
// genuinely better rule" but "what would it actually cost, in real
// drawdown, to push THIS SAME strategy's return up toward a specific
// target (e.g. 100%/year)". Takes a day-by-day equity curve from
// simulatePaperBot.ts and replays it at N times leverage — i.e. what if
// every day's gain or loss had been N times bigger.
//
// Important limitation, in both directions:
//  - It does NOT model margin calls/forced liquidation beyond the simple
//    "wiped out stays wiped out" floor below — a real leveraged or margin
//    account can get force-closed by the broker mid-day on a big enough
//    move, at a worse price than this model assumes. Real risk at high
//    leverage is probably WORSE than what this shows, not better.
//  - It also doesn't model the actual cost of borrowing to get that
//    leverage (margin interest, swap fees on a leveraged product) — real
//    returns at any leverage level would be lower than shown here.

export interface LeverageResult {
  leverage: number;
  totalReturnPct: number;
  annualizedReturnPct: number;
  maxDrawdownPct: number;
  wipedOut: boolean; // hit -100% on a single day and never recovered — the account would have been margin-called
}

export function applyLeverage(dailyValues: number[], leverage: number, tradingDaysPerYear = 252): LeverageResult {
  if (dailyValues.length === 0) {
    return { leverage, totalReturnPct: 0, annualizedReturnPct: 0, maxDrawdownPct: 0, wipedOut: false };
  }

  const startValue = dailyValues[0];
  let equity = startValue;
  let peak = startValue;
  let maxDrawdownPct = 0;
  let wipedOut = false;

  for (let i = 1; i < dailyValues.length; i++) {
    if (wipedOut) continue; // a real margin call ends the account — it doesn't un-happen
    const baseReturn = dailyValues[i] / dailyValues[i - 1] - 1;
    let leveredReturn = baseReturn * leverage;
    if (leveredReturn <= -1) {
      leveredReturn = -1;
      wipedOut = true;
    }
    equity = equity * (1 + leveredReturn);
    peak = Math.max(peak, equity);
    const drawdown = ((peak - equity) / peak) * 100;
    maxDrawdownPct = Math.max(maxDrawdownPct, drawdown);
  }

  const totalReturnPct = ((equity - startValue) / startValue) * 100;
  const years = (dailyValues.length - 1) / tradingDaysPerYear;
  const annualizedReturnPct =
    years > 0 && equity > 0 ? (Math.pow(equity / startValue, 1 / years) - 1) * 100 : wipedOut ? -100 : totalReturnPct;

  return { leverage, totalReturnPct, annualizedReturnPct, maxDrawdownPct, wipedOut };
}
