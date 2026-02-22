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

## Data Refresh

- Prices: every **60 seconds**
- News: every **5 minutes**
- Arbitrage alerts: debounced to **once per 5 minutes** per pair

## Disclaimer

Not financial advice. Data provided for informational purposes only.
