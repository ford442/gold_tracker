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
- **Gold News Feed** — Curated mock headlines today ([#52](https://github.com/ford442/gold_tracker/issues/52) tracks a server-side RSS proxy)
- **Mobile & PWA** — Section-based navigation, touch controls, installable PWA with offline price snapshots
- **Dark/Light Mode** — Persisted via localStorage

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

Coverage scope includes pure modules (`utils`, `regime`, `strategyEngine`, `krakenApi`, `metalprice`, `assets`, `fiscalYear`, `alertRules`, `paperTrade`, `exchanges`, `marketCache`). Network/API client files (`api.ts`, `coinbase.ts`, `supabase.ts`) are excluded — see `vite.config.ts`.

### End-to-end (Playwright)

Smoke E2E tests in `e2e/` cover the critical paths: app loads in mock mode, theme (D) + settings (S), section navigation, portfolio add/remove, and a strategy backtest. External market APIs are blocked per test (`e2e/fixtures.ts`) so runs are deterministic and never hit live CoinGecko/MetalPrice.

```bash
npm run test:e2e        # build + preview + run smoke suite (headless Chromium)
npm run test:e2e:ui     # interactive Playwright UI mode
```

First run needs the browser once: `npx playwright install chromium`. CI runs the suite as a separate `e2e` job on every push and PR.

CI runs `npm run lint`, `npm test`, `npm run test:coverage`, and `npm run build` on every push and pull request to `main`. Lint fails the job on **errors** only; one known warning remains in `StrategyDashboard.tsx` (`react-hooks/exhaustive-deps`).

On `main`, CI also uploads a `goldtrackr-dist` build artifact and deploys to the server via SSH deploy key (`SSH_PRIVATE_KEY` secret).

## Data Refresh

- Prices: every **60 seconds**
- Coinbase balances: every **60 seconds** (when sync enabled)
- News: every **5 minutes** (mock data)
- Arbitrage alerts: debounced to **once per 5 minutes** per pair

## Roadmap

Direction is tracked in [GitHub Issues](https://github.com/ford442/gold_tracker/issues). Current themes:

- **Docs** — [#51](https://github.com/ford442/gold_tracker/issues/51) refresh `code_plan.md` / roadmap (this pass)
- **OMS foundation** — [#46](https://github.com/ford442/gold_tracker/issues/46) order lifecycle, [#45](https://github.com/ford442/gold_tracker/issues/45) shared registry, [#47](https://github.com/ford442/gold_tracker/issues/47) adapter unification, [#50](https://github.com/ford442/gold_tracker/issues/50) live risk engine *(issues may be closed before merge — verify on `main`)*
- **Data & markets** — [#48](https://github.com/ford442/gold_tracker/issues/48) WebSocket prices, [#52](https://github.com/ford442/gold_tracker/issues/52) news proxy, [#53](https://github.com/ford442/gold_tracker/issues/53) real multi-venue arb
- **Performance** — [#54](https://github.com/ford442/gold_tracker/issues/54) analytics web workers

See **[docs/ROADMAP.md](docs/ROADMAP.md)** for a one-page summary and **[code_plan.md](code_plan.md)** for the full OMS vision with Done/Remaining checklists.

## Security

GoldTrackr can store exchange API keys in two modes. **Use server-secure mode for any real trading.**

### Threat model

| Mode | Where keys live | Risk | Recommended use |
|------|-----------------|------|-----------------|
| **Local (unsigned)** | Plaintext in `localStorage` via Zustand (`goldtrackr-settings`) | Any XSS on this origin can read keys; shared devices retain keys until cleared | Dry-run / dev only |
| **Server-secure (signed in)** | AES-GCM encrypted in Supabase; decrypted only inside Edge Functions (`store-key`, `place-trade`) | Keys never re-downloaded to the browser after upload; Supabase account + RLS protect stored ciphertext | Real trading |

**Client assumptions**

- The browser is trusted only for the current session while entering keys.
- Malicious scripts (XSS), browser extensions, or physical access to an unlocked device can exfiltrate **local** keys.
- Server-secure mode removes plaintext from the browser after a successful save.

**Operational hygiene**

- Grant **Trade** permission only — never Withdraw or Transfer.
- Keep **Dry-Run** enabled until connectivity is verified.
- Use **Clear local keys** in Settings before leaving a shared machine.
- CI deploy uses an SSH private key (`SSH_PRIVATE_KEY`) and `ssh-keyscan` for host verification — do not use password SSH or `StrictHostKeyChecking=no` in production pipelines.
- `deploy_old.py` is **deprecated** (hardcoded password, no host key verification). Use `.github/workflows/ci.yml` rsync deploy instead.

### Stretch: ephemeral session unlock

A future enhancement could encrypt keys in `sessionStorage` with a user passphrase (PBKDF2 + AES-GCM) so plaintext never touches `localStorage`. That would still be vulnerable to XSS while the session is unlocked but would reduce idle-device exposure. Server-secure mode remains the preferred path for live trading.

## Disclaimer

Not financial advice. Data provided for informational purposes only.
