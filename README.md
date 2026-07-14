# GoldTrackr 🥇

Real-time gold & crypto dashboard tracking PAXG, XAUT, BTC, ETH with correlations, arbitrage alerts, and a portfolio tracker.

## Features

- **Live Price Dashboard** — Spot gold (XAU), PAXG, XAUT, BTC, ETH with 24h/7d changes and sparklines
- **Correlation Matrix** — Pearson correlation across 1h/1d/7d/30d periods
- **Arbitrage Alerts** — Auto-detects PAXG/XAUT spread > 0.5% and fires desktop alerts
- **Portfolio Tracker** — Track positions with unrealized P&L, gold exposure %, and crypto beta %
- **Gold News Feed** — Filtered Kitco RSS feed (gold, PAXG, XAUT, BTC, Fed, inflation, tariffs)
- **Dark/Light Mode** — Persisted via localStorage

## Tech Stack

- React 19 + TypeScript + Vite
- TailwindCSS v4 (`@tailwindcss/vite`)
- Zustand (state management + localStorage persistence)
- Recharts (sparkline charts)
- CoinGecko API (crypto prices)
- MetalPrice API (spot gold)
- Kitco RSS (gold news via allorigins CORS proxy)

## Getting Started

```bash
npm install
cp .env.local.example .env.local
# (optionally add API keys to .env.local)
npm run dev
```

## API Keys (Optional)

| Variable | Source | Notes |
|---|---|---|
| `VITE_COINGECKO_API_KEY` | [coingecko.com/api](https://www.coingecko.com/en/api) | Free demo key available |
| `VITE_METALPRICE_API_KEY` | [metalpriceapi.com](https://metalpriceapi.com) | Free tier: 100 calls/day |

Without API keys, the app uses realistic mock data automatically.

## Mobile & PWA

GoldTrackr uses **section-based navigation** (one panel at a time), touch-friendly controls, and an optional installable PWA with offline price snapshots.

See **[docs/MOBILE.md](docs/MOBILE.md)** for layout notes, PWA install steps, offline banner behavior, and **Lighthouse mobile performance targets** (Performance ≥ 85, Accessibility ≥ 90, etc.).

```bash
npm run build && npm run preview   # test PWA + production bundle locally
```

## Testing

Pure math / strategy modules in `src/lib/` are covered by [Vitest](https://vitest.dev/) unit tests.

```bash
npm test              # run all tests once
npm run test:watch    # watch mode during development
npm run test:coverage # coverage gate: pure src/lib modules ≥ 70% statements
```

Coverage scope includes pure modules (`utils`, `regime`, `strategyEngine`, `krakenApi`, `metalprice`, `assets`). Network/API client files (`api.ts`, `coinbase.ts`, `supabase.ts`) are excluded — see `vite.config.ts`.

CI runs `npm run lint`, `npm test`, `npm run test:coverage`, and `npm run build` on every push and pull request to `main`. Lint fails the job on **errors** only; one known warning remains in `StrategyDashboard.tsx` (`react-hooks/exhaustive-deps`).

On `main`, CI also uploads a `goldtrackr-dist` build artifact and deploys to the server via SSH deploy key (`SSH_PRIVATE_KEY` secret; replace legacy `SSH_PASSWORD` if still configured).

## Data Refresh

- Prices: every **60 seconds**
- News: every **5 minutes**
- Arbitrage alerts: debounced to **once per 5 minutes** per pair

## Disclaimer

Not financial advice. Data provided for informational purposes only.
