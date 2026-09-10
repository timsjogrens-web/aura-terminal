This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Running the test suite

Unit tests use [Vitest](https://vitest.dev) and require no network access or database — they run against synthetic, hand-calculated data.

```bash
npm test
```

This covers, among other things, a look-ahead-bias regression test for the backtest engine (`src/lib/backtest.test.ts`): it proves that a signal computed on day N never changes depending on data that only becomes available after day N.

## Running a backtest

The backtest engine (`src/lib/backtest.ts`) can be exercised two ways:

- **Via the site**: start the dev server (below) and open `/backtest`, pick a ticker and score weights.
- **Via the API directly**: `GET /api/backtest?ticker=AAPL&range=1Y&trend=40&momentum=30&volume=30` (requires an authenticated session cookie, same as the rest of the app).

Execution is modeled at the next trading day's open (never the same close a signal was computed from), on dividend-adjusted prices, with an estimated round-trip cost (commission + FX fee + liquidity-tiered slippage, see `src/lib/tradingCosts.ts`) applied to every simulated trade.

## Strategy research (offline, not part of the live site)

`src/research/` tests long-only, monthly-rebalanced factor strategies (momentum, low-volatility, and an equal-weighted composite of the two) against the tracked universe and the S&P 500, with a locked hold-out period that's never used to pick a strategy or tune a parameter:

```bash
npx tsx src/research/runResearch.ts
```

The first run fetches ~10 years of monthly history from Yahoo Finance and caches it under `src/research/.cache/` (gitignored); delete that file to refetch. Recently-listed tickers (too little history) are automatically excluded from this panel with a stated reason, so one young IPO doesn't silently shrink the whole panel's usable history down to its own short track record.

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
