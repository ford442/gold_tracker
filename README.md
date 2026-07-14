# GoldTrackr 🥇

Real-time gold & crypto terminal tracking spot gold, tokenized gold (PAXG, XAUT), and major crypto (BTC, ETH, BCH) with correlations, arbitrage detection, backtesting, portfolio tracking, and optional exchange trading.

> **Not financial advice.** Data is provided for informational and educational purposes only. Trading features default to dry-run.

## Features

- **Live Price Dashboard** — Spot gold (XAU), PAXG, XAUT, BTC, ETH, BCH with 24h/7d changes and sparklines (60s auto-refresh)
- **Precious Metals Panel** — Spot silver, platinum, and palladium alongside gold
- **Correlation Matrix** — Pearson correlation across 1h/1d/7d/30d periods
- **Fidelity & Regimes Lens** — Gold Fidelity Scores, long-horizon correlations, rolling divergence history, and volatility/drawdown regime classification (spot gold long history is synthesized/estimated and labeled as such)
- **Analytics Charts** — Fiscal-year gold chart, multi-asset 14-day normalized performance comparison, and advanced 5-tab gold comparison tools
- **Arbitrage Alerts** — Auto-detects PAXG/XAUT spread opportunities and fires desktop alerts (debounced per pair)
- **Global Arbitrage Monitor** — Multi-signal arb view (synthetic market signals)
- **Trade Suggestions** — Signals derived from live spreads and spot gold, with optional execution
- **Portfolio Tracker** — Positions with unrealized P&L, gold exposure %, crypto beta %, P&L-over-time chart, and optional Coinbase balance sync
- **Strategy Lab** — Pure-TypeScript backtesting engine (arbitrage, mean-reversion, gold-exposure rebalancer, hold), equity curve, trade log, and a **Scenario Lab** for macro-shock stress tests
- **Trade Replay** — Buy/sell markers with forward projections
- **Exchange Trading (optional)** — Coinbase (CDP ES256 JWT) and Kraken (direct PAXG/XAUT pair), in local or server-secure mode
- **Gold News Feed** — Curated gold/crypto/macro headlines (currently mock data — see note below)
- **Mobile & PWA** — Section-based navigation, touch controls, installable PWA with offline price snapshots
- **Dark/Light Mode** — Persisted via localStorage

> **News note:** Live Kitco RSS fetching is currently **disabled** due to CORS-proxy reliability issues. `fetchGoldNews()` returns curated mock headlines. See `src/lib/api.ts`.

## Architecture

Data flows in one direction through four layers. Pure logic stays free of React so it can be unit-tested in isolation.

```
┌─────────────────────────────────────────────────────────────────┐
│  External feeds:  CoinGecko · MetalPrice · Coinbase · Kraken     │
│                   Supabase (auth + Edge Functions)               │
└───────────────────────────────┬─────────────────────────────────┘
                                 │
   ┌─────────────────────────────▼──────────────────────────────┐
   │  src/lib/  — PURE logic + API clients (no React)            │
   │  api · assets · utils · regime · strategyEngine · fiscalYear│
   │  metalprice · krakenApi · coinbase · coinbaseTrader         │
   │  alertRules · priceSnapshot · supabase                      │
   └─────────────────────────────┬──────────────────────────────┘
                                 │  called by
   ┌─────────────────────────────▼──────────────────────────────┐
   │  src/hooks/  — React hooks (polling, derivation)            │
   │  useGoldPrices · useCorrelations · useRegimeAnalysis        │
   │  useTradeSuggestions · useStrategyBacktest · useNews · …    │
   └─────────────────────────────┬──────────────────────────────┘
                                 │  write to / read from
   ┌─────────────────────────────▼──────────────────────────────┐
   │  src/store/  — Zustand stores (single source of truth)      │
   │  priceStore · portfolioStore · settingsStore · themeStore   │
   │  strategyStore · alertStore · alertRulesStore · useAuthStore│
   └─────────────────────────────┬──────────────────────────────┘
                                 │  render from
   ┌─────────────────────────────▼──────────────────────────────┐
   │  src/components/  — UI (5 lazy sections, one mounts at a time)│
   │  Overview · Analytics · Portfolio · Strategies · Markets    │
   └─────────────────────────────────────────────────────────────┘
```

**Rule for contributors & agents:** put pure math / API logic in `src/lib/` (with Vitest coverage), expose it through a hook, keep state in a Zustand store, and let components stay thin. See **[AGENTS.md](AGENTS.md)** for the full guide.

## Tech Stack

- React 19 + TypeScript 5.9 + Vite 7
- TailwindCSS v4 (`@tailwindcss/vite`) — glass-morphism design system, dark-first
- Zustand (state management + localStorage persistence)
- Recharts (charts)
- `jose` (JWT signing), `react-hot-toast` (notifications)
- Supabase (optional backend: Auth + Postgres + Edge Functions)
- CoinGecko API (crypto prices + historical charts)
- MetalPrice API (spot gold & metals)
- Coinbase (CDP) & Kraken (trade execution)

## Getting Started

```bash
npm install
cp .env.local.example .env.local
# (optionally add API keys to .env.local)
npm run dev
```

Without any API keys the app runs entirely on realistic mock data, so the dashboard, portfolio, correlations, and backtests are all fully usable for development.

## API Keys (Optional)

| Variable | Source | Notes |
|---|---|---|
| `VITE_COINGECKO_API_KEY` | [coingecko.com/api](https://www.coingecko.com/en/api) | Free demo key available |
| `VITE_METALPRICE_API_KEY` | [metalpriceapi.com](https://metalpriceapi.com) | Free tier: 100 calls/day |
| `VITE_SUPABASE_URL` | [supabase.com](https://supabase.com) | Optional — server-secure trading |
| `VITE_SUPABASE_ANON_KEY` | [supabase.com](https://supabase.com) | Optional — server-secure trading |

Without API keys, the app uses realistic mock data automatically.

## Trading (Optional)

GoldTrackr can place trades on **Coinbase** (CDP API keys, ES256 JWT) or **Kraken** (direct PAXG/XAUT pair). Two modes:

| | Local Mode | Server-Secure Mode |
|---|---|---|
| Key storage | localStorage (documented XSS risk) | AES-GCM encrypted in Supabase |
| Auth | None | Supabase Auth |
| Execution | Client-side JWT | Supabase Edge Function |

Dry-run is enabled by default. See **[AGENTS.md](AGENTS.md)** and **[supabase/DEPLOY.md](supabase/DEPLOY.md)** for setup and the threat model.

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

Coverage scope includes pure modules (`utils`, `regime`, `strategyEngine`, `krakenApi`, `metalprice`, `assets`, `fiscalYear`, `alertRules`). Network/API client files (`api.ts`, `coinbase.ts`, `supabase.ts`) are excluded — see `vite.config.ts`.

CI runs `npm run lint`, `npm test`, `npm run test:coverage`, and `npm run build` on every push and pull request to `main`. Lint fails the job on **errors** only; one known warning remains in `StrategyDashboard.tsx` (`react-hooks/exhaustive-deps`).

On `main`, CI also uploads a `goldtrackr-dist` build artifact and deploys to the server via SSH deploy key (`SSH_PRIVATE_KEY` secret).

## Data Refresh

- Prices: every **60 seconds**
- Coinbase balances: every **60 seconds** (when sync enabled)
- News: every **5 minutes** (mock data)
- Arbitrage alerts: debounced to **once per 5 minutes** per pair

## Roadmap

Direction is tracked in [GitHub Issues](https://github.com/ford442/gold_tracker/issues). Current themes:

- **Foundation** — [#39](https://github.com/ford442/gold_tracker/issues/39) docs refresh (this), [#40](https://github.com/ford442/gold_tracker/issues/40) typed Supabase client & key-persistence audit, [#34](https://github.com/ford442/gold_tracker/issues/34) shared market-history cache, [#36](https://github.com/ford442/gold_tracker/issues/36) Playwright smoke E2E
- **Trading & data** — [#38](https://github.com/ford442/gold_tracker/issues/38) WebSocket streaming prices, [#35](https://github.com/ford442/gold_tracker/issues/35) paper-trading ledger, [#33](https://github.com/ford442/gold_tracker/issues/33) multi-exchange expansion
- **Analytics** — [#41](https://github.com/ford442/gold_tracker/issues/41) tax-lot / cost-basis export & gold-oz reporting

See **[code_plan.md](code_plan.md)** for the longer OMS vision with a done-vs-remaining checklist.

## Disclaimer

Not financial advice. Data provided for informational purposes only.
