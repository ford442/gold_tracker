# GoldTrackr — Agent Guide

This document provides essential information for AI coding agents working on the GoldTrackr project.

## Project Overview

GoldTrackr is a real-time gold and cryptocurrency dashboard that tracks PAXG, XAUT, BTC, ETH, and BCH prices. It provides correlation analysis, arbitrage alerts, trade suggestions, portfolio tracking with Coinbase sync, algorithmic strategy backtesting, trade replay with projections, performance comparison, global arbitrage monitoring, and gold-related news aggregation.

**Key Features:**
- Live price dashboard with 24h/7d changes and sparkline charts
- Correlation matrix across multiple time periods (1h/1d/7d/30d) + longer-horizon structural view
- Gold Fidelity Scores, multi-horizon correlations, rolling divergence history, and volatility/drawdown regime lens (Fidelity & Regimes tab)
- Arbitrage alerts for PAXG/XAUT spread opportunities
- Portfolio tracker with unrealized P&L, gold exposure %, crypto beta %, and Coinbase balance sync
- Trade suggestions based on market conditions
- Gold news feed (mock data — RSS fetching disabled due to CORS reliability issues)
- Dark/Light mode with localStorage persistence
- **Coinbase trading integration** with CDP API keys
- **Kraken trading integration** with direct PAXG/XAUT pair support
- **Strategy backtesting engine** with arbitrage and mean-reversion simulations
- **Trade replay chart** with buy/sell markers and forecast projections
- **Performance comparison chart** (14-day normalized returns)
- **Global arbitrage monitor** with synthetic market signals
- **Supabase backend** for secure key storage and multi-exchange trading (optional)

## Technology Stack

| Category | Technology |
|----------|------------|
| Frontend Framework | React 19 (with StrictMode) |
| Language | TypeScript 5.9 |
| Build Tool | Vite 7 |
| Styling | TailwindCSS v4 with CSS custom properties |
| State Management | Zustand (with persist middleware) |
| Charts | Recharts |
| Notifications | react-hot-toast |
| JWT Signing | jose |
| Backend (Optional) | Supabase (Auth + Postgres + Edge Functions + Multi-Exchange) |
| Linting | ESLint 9 with TypeScript, React Hooks, React Refresh |

## External APIs

| API | Purpose | Fallback |
|-----|---------|----------|
| CoinGecko | Crypto prices (PAXG, XAUT, BTC, ETH, BCH) + historical market charts | Mock data |
| MetalPrice | Spot gold prices | Mock data |
| Kitco RSS | Gold-related news | Mock news (RSS disabled due to CORS proxy reliability) |
| Coinbase (CDP) | Trading execution + account balances | N/A |
| Kraken | Trading execution (direct PAXG/XAUT pair) | N/A |

## Architecture Layers

Data flows one way. **Add new capability pure-logic-first**, then expose it upward:

```
src/lib/  (pure, unit-tested)  →  src/hooks/  (React)  →  src/store/  (Zustand, single source of truth)  →  src/components/  (thin UI)
```

- **`src/lib/`** — no React imports. Math, API clients, asset registry, strategy/regime/fiscal engines. Covered by Vitest.
- **`src/hooks/`** — polling, derivation, and side effects; call `lib` and write to stores.
- **`src/store/`** — Zustand stores hold canonical state; components read from here, never fetch directly.
- **`src/components/`** — presentational; one lazy section mounts at a time.

Roadmap and larger design direction live in the repo's [open issues](https://github.com/ford442/gold_tracker/issues) and [code_plan.md](code_plan.md) (OMS vision with a done-vs-remaining checklist).

## Project Structure

The UI is organized as a **section shell** (`App.tsx`) that mounts exactly one of five lazy sections at a time (`src/components/sections/`). Large panels are split into feature sub-folders. See the "Bundle / code splitting" section below.

```
goldtracker/
├── src/
│   ├── components/          # React components
│   │   ├── AppNav.tsx              # Section-based top navigation (Overview/Analytics/Portfolio/Strategies/Markets)
│   │   ├── Dashboard.tsx           # Main price display grid with countdown
│   │   ├── PriceCard.tsx           # Individual crypto price card
│   │   ├── GoldSpotCard.tsx        # Spot gold price card
│   │   ├── PreciousMetalsPanel.tsx # Spot silver/platinum/palladium (+ gold) cards & charts
│   │   ├── CorrelationMatrix.tsx   # Short-term tactical price correlation visualization
│   │   ├── ArbitrageAlerts.tsx     # Arbitrage opportunity alerts
│   │   ├── GlobalArbitrageMonitor.tsx # Global arb monitor with synthetic signals
│   │   ├── PortfolioTracker.tsx    # Portfolio management UI + Coinbase sync (uses portfolio/ folder)
│   │   ├── PnLOverTimeChart.tsx    # Portfolio P&L over time visualization
│   │   ├── TradeSuggestionsPanel.tsx # Trading recommendations + execution (uses tradeSuggestions/ folder)
│   │   ├── NewsFeed.tsx            # News display (mock data)
│   │   ├── SettingsModal.tsx       # Trading settings + auth modal (uses settings/ folder)
│   │   ├── DarkModeToggle.tsx      # Theme switcher
│   │   ├── StrategyDashboard.tsx   # Backtest + Scenario Lab (uses strategy/ folder)
│   │   ├── TradeReplayChart.tsx    # Trade replay with projections and buy/sell markers (uses tradeReplay/ folder)
│   │   ├── PerformanceComparisonChart.tsx # 14-day normalized returns chart
│   │   ├── FiscalYearChart.tsx     # Fiscal-year gold performance chart (pure math in lib/fiscalYear.ts)
│   │   ├── GoldComparisonTools.tsx # Advanced 5-tab comparison (incl. Fidelity & Regimes tab; uses goldComparison/ folder)
│   │   ├── RegimeLens.tsx          # Fidelity & Regimes tab content (scores, long matrix, rolling corr history, live deltas, NFA framing)
│   │   ├── OfflineBanner.tsx       # PWA offline indicator
│   │   ├── LazyPanel.tsx / SectionFallback.tsx / LoadingSkeleton.tsx # Lazy-load + skeleton helpers
│   │   ├── sections/               # One-per-view shells (mounted lazily by App.tsx)
│   │   │   ├── OverviewSection.tsx      # Dashboard + PreciousMetals + TradeSuggestions + ArbitrageAlerts
│   │   │   ├── AnalyticsSection.tsx     # CorrelationMatrix + GoldComparisonTools + FiscalYearChart + PerformanceComparison
│   │   │   ├── PortfolioSection.tsx     # PortfolioTracker
│   │   │   ├── StrategiesSection.tsx    # StrategyDashboard + TradeReplayChart
│   │   │   └── MarketsSection.tsx       # GlobalArbitrageMonitor + NewsFeed
│   │   ├── alerts/                 # AlertRuleForm, AlertRulesManager
│   │   ├── goldComparison/         # 5-tab sub-components (Overlay/Premiums/Currencies/Portfolio + constants/helpers)
│   │   ├── portfolio/              # Portfolio table/summary/entry-form sub-components + portfolioUtils
│   │   ├── settings/               # Auth, ExchangeKeys, DryRun, SecurityWarnings panels
│   │   ├── strategy/               # Backtest config, Scenario Lab, equity curve, trade log sub-components
│   │   ├── tradeReplay/            # Replay chart, projection controls, replay data/hooks
│   │   └── tradeSuggestions/       # Suggestion cards, execute controls, useTradeExecution
│   ├── hooks/               # Custom React hooks
│   │   ├── useGoldPrices.ts        # Price polling (60s interval)
│   │   ├── useAppSection.ts        # Active section state (hash-synced)
│   │   ├── useTradeSuggestions.ts  # Trading signal generation
│   │   ├── useCorrelations.ts      # Correlation calculations (short-term tactical on sparklines)
│   │   ├── useRegimeAnalysis.ts    # Long-horizon regime/fidelity data (powers Fidelity & Regimes tab)
│   │   ├── useFidelityScores.ts    # Gold Fidelity Score derivation
│   │   ├── useStrategyBacktest.ts  # Runs the pure strategyEngine for the dashboard
│   │   ├── useAlertRules.ts        # Configurable alert-rule evaluation
│   │   ├── useConnectivityStatus.ts # Online/offline detection for OfflineBanner
│   │   ├── useNews.ts              # News fetching (5 min, mock)
│   │   └── useCoinbaseBalances.ts  # Coinbase account balance polling (60s)
│   ├── store/               # Zustand state stores
│   │   ├── priceStore.ts           # Price data state (single source of truth)
│   │   ├── themeStore.ts           # Dark/light mode (persisted)
│   │   ├── portfolioStore.ts       # Portfolio entries with Coinbase sync (persisted)
│   │   ├── settingsStore.ts        # Trading settings + exchange selection (persisted)
│   │   ├── alertStore.ts           # Alert notifications
│   │   ├── alertRulesStore.ts      # User-configured alert rules (persisted)
│   │   ├── strategyStore.ts        # Strategy backtest config + results (persisted)
│   │   └── useAuthStore.ts         # Supabase auth state
│   ├── services/            # API service layer
│   │   └── tradeService.ts         # Supabase Edge Function calls (store keys, test connection, execute trade)
│   ├── types/               # TypeScript definitions
│   │   ├── index.ts                # Core types (PriceData, GoldSpot, MetalSpot, PortfolioEntry, AlertItem, NewsItem, ThemeMode, Chart types)
│   │   └── TradeSuggestion.ts      # Trade suggestion types
│   ├── lib/                 # PURE logic + API clients (no React) — unit-tested with Vitest
│   │   ├── api.ts                  # API fetching functions (CoinGecko, MetalPrice, mock data, mock news)
│   │   ├── assets.ts               # Single source of truth for tracked assets (ids, symbols, CoinGecko/Coinbase mapping)
│   │   ├── utils.ts                # Formatting and math utilities
│   │   ├── metalprice.ts           # Spot metal parsing/normalization helpers
│   │   ├── fiscalYear.ts           # Pure fiscal-year gold chart math
│   │   ├── regime.ts               # Pure regime/fidelity math (vol, max DD, rolling corrs, Gold Fidelity Score, synth spot, alignment)
│   │   ├── strategyEngine.ts       # Pure backtest engine (arbitrage + mean-reversion + rebalancer + hold)
│   │   ├── strategyMockTicks.ts    # Mock tick generator for backtests
│   │   ├── alertRules.ts           # Pure alert-rule evaluation
│   │   ├── alertNotifications.ts   # Desktop notification helpers
│   │   ├── priceSnapshot.ts        # Offline price snapshot persistence (PWA)
│   │   ├── appSections.ts          # Section registry (ids, labels, shortcuts, nav helpers)
│   │   ├── lazyNamed.ts            # Named-export React.lazy helper
│   │   ├── supabase.ts             # Supabase client with graceful mock fallback
│   │   ├── coinbase.ts             # Coinbase CDP account fetching (getCoinbaseAccounts)
│   │   ├── coinbaseTrader.ts       # Client-side CDP JWT signing + order placement
│   │   └── krakenApi.ts            # Kraken pair mapping and fee comparison utilities
│   ├── App.tsx              # Section shell + keyboard shortcuts
│   ├── main.tsx             # Entry point (StrictMode)
│   └── index.css            # Global styles with CSS variables (glass-morphism design system)
├── supabase/                # Supabase backend
│   ├── functions/           # Edge Functions
│   │   ├── store-key/index.ts      # Encrypt & store exchange API keys (AES-GCM)
│   │   ├── place-trade/index.ts    # Execute trades on Coinbase/Kraken (jose library)
│   │   └── test-connection/index.ts # Test exchange connectivity
│   ├── schema.sql           # Database schema (user_exchange_keys, trade_logs, RLS policies)
│   ├── DEPLOY.md            # Deployment guide
│   └── README.md            # Backend documentation
├── public/                  # Static assets
├── deploy.py                # SFTP deployment script
└── [config files]
```

## Build Commands

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Run ESLint
npm run lint

# Preview production build
npm run preview
```

## Bundle / code splitting

Production builds use a **section shell** plus **lazy panels** so first paint stays small.

| Layer | Eager (initial) | Lazy (`React.lazy` + `Suspense`) |
|-------|-----------------|----------------------------------|
| Shell | `App.tsx` header, `AppNav`, `Dashboard`, price poll hook, theme | — |
| Sections | — | `OverviewSection`, `AnalyticsSection`, `PortfolioSection`, `StrategiesSection`, `MarketsSection` (only active section mounts) |
| Panels | `Dashboard` + price cards (above fold) | Below-fold overview panels, all analytics/strategy/market charts, `PortfolioTracker`, `SettingsModal` (on first open) |
| Vendors | — | `react-vendor`, `recharts`, `supabase`, `jose` via `build.rollupOptions.output.manualChunks` in `vite.config.ts` |

**Helpers:** `src/lib/lazyNamed.ts` (named-export lazy), `src/components/LazyPanel.tsx` (panel + `LoadingSkeleton` fallback), `src/components/SectionFallback.tsx` (section transition).

**Auth bootstrap:** `useAuthStore.init()` is idempotent and runs when `SettingsModal` or `TradeSuggestionsPanel` first mount — not on app shell load — so `@supabase/supabase-js` stays out of the entry chunk until needed.

**Keyboard:** `S` still toggles settings; first open shows `ModalSkeleton` while the settings chunk loads.

**Component size:** Large panels are split into feature folders (`strategy/`, `goldComparison/`, `settings/`, `tradeSuggestions/`, `portfolio/`, `tradeReplay/`). Pure chart/math logic lives in `src/lib/` (e.g. `fiscalYear.ts`, `strategyMockTicks.ts`, `strategyEngine.ts`) with unit tests where non-trivial.

## Development Conventions

### TypeScript Configuration

- **Target**: ES2022
- **Module**: ESNext with bundler resolution
- **Strict mode**: Enabled with additional checks:
  - `noUnusedLocals`: true
  - `noUnusedParameters`: true
  - `erasableSyntaxOnly`: true
  - `noFallthroughCasesInSwitch`: true
  - `noUncheckedSideEffectImports`: true
  - `verbatimModuleSyntax`: true

### Code Style

- Use functional components with hooks
- Prefer inline styles for component-specific styling using CSS variables
- Use Tailwind classes for common utilities (flex, grid, spacing, etc.)
- Import type-only imports with `import type { ... }`
- File extensions: `.tsx` for components, `.ts` for utilities
- Props interfaces use `interface Props { ... }` naming

### CSS Variables (Theme System)

The project uses an extensive glass-morphism design system with CSS custom properties. Dark mode is default; `.light` class is applied to `:root` for light mode.

```css
/* Key color variables */
--color-bg              /* Background color */
--color-bg-deep         /* Deep background layer */
--color-surface         /* Card/surface background (glass) */
--color-surface-solid   /* Opaque surface */
--color-surface2        /* Elevated surface */
--color-border          /* Border color */
--color-border-strong   /* Stronger border */
--color-text            /* Primary text */
--color-muted           /* Secondary/muted text */
--color-gold            /* Gold accent (#f0c845) */
--color-gold-bright     /* Bright gold (#f7d86c) */
--color-gold-dim        /* Dim gold background */
--color-green           /* Positive changes (#00dba6) */
--color-green-dim       /* Dim green background */
--color-red             /* Negative changes (#ff5a78) */
--color-red-dim         /* Dim red background */
--color-blue            /* Positive correlation (#4299e1) */
--color-accent          /* Primary accent (#7c5cfc) */
--color-accent-dim      /* Dim accent background */
--color-cyan            /* Cyan accent (#22d3ee) */

/* Typography */
--font-xxs through --font-2xl

/* Spacing */
--space-xs through --space-3xl

/* Radii */
--radius-sm through --radius-full

/* Glass card system */
--glass-bg, --glass-border, --glass-shadow, --glass-shadow-hover, --glass-sheen

/* Animation */
--duration-fast, --duration-normal, --duration-slow, --ease-out, --ease-spring
```

### Utility CSS Classes

```css
.glass-card           /* Standard glass card */
.glass-card-gold      /* Gold-accented glass card */
.reflection-zone      /* Reflection effect beneath hero cards */
.skeleton             /* Pulse animation for loading states */
.table-zebra          /* Zebra-striped table with hover gold highlight */
.range-pill           /* Toggle button/pill (used for time ranges) */
.badge-green          /* Green status badge */
.badge-red            /* Red status badge */
.badge-gold           /* Gold status badge */
.badge-accent         /* Accent status badge */
.flash-up / .flash-down   /* Price flash animations */
.live-pulse           /* Live indicator dot animation */
.card-hover           /* Hover elevation transition */
.section-divider      /* Horizontal gradient divider */
.section-alt          /* Alternating section background */
.progress-bar         /* Countdown progress bar */
.tooltip-trigger      /* CSS-only tooltip */
.accordion-content    /* Accordion expand/collapse */
.section-heading      /* Section heading with icon */
.change-chip-green / .change-chip-red  /* +/- change indicators */
```

### State Management Patterns

**Zustand stores** follow this pattern:

```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface StoreState {
  // State
  data: SomeType;
  // Actions
  setData: (data: SomeType) => void;
}

// For persisted stores:
export const useStore = create<StoreState>()(
  persist(
    (set) => ({...}),
    { name: 'goldtrackr-storename' }
  )
);
```

**Transient state example** (from `strategyStore`):
```typescript
{
  name: 'goldtrackr-strategy',
  onRehydrateStorage: () => (state) => {
    if (state) state.isRunning = false; // Reset on reload
  },
}
```

### Data Refresh Intervals

- **Prices**: 60 seconds (`POLL_INTERVAL` in `useGoldPrices.ts`)
- **News**: 5 minutes (mock data only)
- **Arbitrage alerts**: Debounced to once per 5 minutes per pair
- **Coinbase balances**: 60 seconds when sync enabled (`useCoinbaseBalances.ts`)

### API Key Configuration

Copy `.env.local.example` to `.env.local` and optionally add:

```bash
VITE_COINGECKO_API_KEY=your_key_here
VITE_METALPRICE_API_KEY=your_key_here
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

The app gracefully falls back to realistic mock data when API keys are not provided.

## Trading & Exchange Integration

### Two Modes of Operation

| Feature | Local Mode | Server-Secure Mode |
|---------|-----------|-------------------|
| Key Storage | localStorage (Zustand persist) | AES-GCM encrypted in Supabase |
| Authentication | None required | Supabase Auth required |
| Trade Execution | Client-side JWT | Server-side Edge Function |
| Multi-device | ❌ | ✅ |
| Security Level | Good | Excellent |
| Setup | None | Supabase project required |

### Supported Exchanges

| Exchange | Auth Method | Special Features |
|----------|-------------|------------------|
| Coinbase | CDP API Keys (ES256 JWT) | Account balance sync to portfolio |
| Kraken | HMAC-SHA512 | Direct PAXG/XAUT pair (lower fees) |

### Exchange Selection

Users select their preferred exchange in Settings. The app routes all trade execution to the selected exchange:
- **Coinbase**: PAXG → USD → XAUT requires 2 trades (1.2% total fees)
- **Kraken**: PAXG → XAUT direct (1 trade, 0.26% fee) — ~0.94% savings

### Coinbase CDP API Keys (2026 Standard)

The app uses the modern Coinbase Developer Platform (CDP) API with ES256 JWT signing:

1. Go to https://portal.cdp.coinbase.com/
2. Create API Keys → Download private key (PEM format)
3. Copy Key Name (format: `organizations/{org_id}/apiKeys/{key_id}`)
4. Paste both in Settings modal

### Client-Side Trading (Local Mode)

Uses `src/lib/coinbaseTrader.ts`:
- Web Crypto API for JWT signing (ES256)
- Keys stored in localStorage via Zustand
- Direct fetch to Coinbase API

Uses `src/lib/coinbase.ts`:
- Fetches Coinbase account balances
- Maps currency codes to internal asset IDs
- Portfolio store syncs balances automatically

### Server-Side Trading (Supabase Mode)

Uses `src/services/tradeService.ts` → Supabase Edge Functions:
- Keys encrypted with AES-GCM before storage
- JWT signing happens in Edge Function using `jose` library
- Keys never touch browser after upload
- Supports both Coinbase and Kraken execution

## Strategy Engine & Backtesting

### `src/lib/strategyEngine.ts`

A pure TypeScript backtesting engine with no React dependencies.

**Implemented Strategies:**

1. **Arbitrage Strategy** (`createArbitrageStrategy`)
   - Monitors spread between two correlated assets (default: PAXG/XAUT)
   - Enters long the cheaper asset when spread > threshold
   - Exits when spread converges to ≤ threshold/2
   - Only one position open at a time

2. **Mean Reversion Strategy** (`createMeanReversionStrategy`)
   - Computes rolling SMA over a window of ticks
   - Buys when price dips X% below SMA
   - Sells at take-profit (Y% above SMA) or stop-loss
   - Uses Ornstein-Uhlenbeck synthetic price generation

3. **Gold Exposure Rebalancer** (`createGoldExposureRebalancer`)
   - Targets a % of total equity in the gold sleeve (PAXG/XAUT/gold)
   - Rebalances only when actual % deviates beyond a configurable band
   - Emits BUY/SELL signals; works with seeded real portfolio holdings via runBacktest initialPositions

4. **Hold** (`createHoldStrategy`)
   - No-op benchmark for "buy & hold under shocks"

**Backtest Runner** (`runBacktest`):
- Processes chronologically ordered price ticks
- Tracks equity curve, trade log, max drawdown
- Liquidates open positions at final tick prices
- Returns: `BacktestResult` with total return, win rate, equity curve, trades
- Lightly extended (Feature 3): optional 4th param `initialPositions` for seeding from PortfolioEntry snapshots (units + avgCost). Backward compatible.
- Pure helpers: `applyShocksToTicks`, `generateBaseScenarioTicks` for scenario/stress what-ifs (simple multipliers + ramp on base series).

### `StrategyDashboard` Component

- Strategy configurator with validation
- Internal "Classic Backtest" vs "Scenario Lab" modes (pills)
- Scenario Lab: 5 built-in macro shocks + custom % moves, seed from live portfolio (usePortfolioStore), extra cash + DCA inputs, runs rebalancer + hold benchmarks, shows equity, trades, final gold oz, comparisons
- Mock tick generator (720 ticks = 30 days of hourly data) + shock application
- Equity curve area chart (reused for both modes)
- Trade log table (last 100 executions)
- Performance stat boxes (final balance, return, max drawdown, win rate, trades)
- Strong repeated "simulation / not financial advice" framing

## Component Patterns

### Props Interface Naming

```typescript
interface Props {
  data: PriceData;
  goldPrice?: number;
}

export function PriceCard({ data, goldPrice }: Props) { ... }
```

### Store Usage in Components

```typescript
import { usePriceStore } from '../store/priceStore';

export function Dashboard() {
  const { prices, goldSpot, isLoading, lastUpdated } = usePriceStore();
  // Component logic...
}
```

### Keyboard Shortcuts (in App.tsx)

- `D` — Toggle dark/light mode
- `R` — Refresh prices immediately
- `S` — Open/close settings modal

## Utility Functions

Key utilities in `src/lib/utils.ts`:

- `formatPrice(price, decimals)` - Format as USD currency
- `formatPercent(pct, showSign)` - Format percentage with optional sign
- `formatNumber(n)` - Compact notation (K, M, B, T)
- `formatTimeAgo(isoString)` - Human-readable relative time
- `pearsonCorrelation(x, y)` - Calculate correlation coefficient
- `computeSpread(price1, price2)` - Calculate percentage spread
- `correlationColor(value)` - Get color for correlation value (-1 to +1)
- `sparklinePrices(points, count)` - Extract price array from SparklinePoint[]
- `getCorrelationStyle(value)` - Shared diverging gradient style for correlation matrices (used by CorrelationMatrix + RegimeLens)
- New in `lib/regime.ts` (pure): `computeFidelityScores`, `annualizedRealizedVol`, `maxDrawdownFromPrices`, `rollingCorrelations`, `generateSyntheticSpotPrices`, `classifyRegime`, `HORIZON_PARAMS`, alignment/downsample helpers. See lib/regime.ts for full list.

## Deployment

### Frontend Deployment

The project includes a Python deployment script (`deploy.py`) that uses SFTP/Paramiko to upload the `dist` folder to a remote server.

```bash
# Build first
npm run build

# Then deploy
python deploy.py
```

**Deployment configuration** (in `deploy.py`):
- Host: 1ink.us
- Remote directory: test.1ink.us/gold

### Supabase Backend Deployment

See `supabase/DEPLOY.md` for complete instructions.

```bash
# Set encryption key
supabase secrets set ENCRYPTION_KEY=$(openssl rand -hex 32)

# Deploy functions
supabase functions deploy store-key place-trade test-connection
```

## Security Considerations

### Local Mode
- API keys stored in localStorage via Zustand persist
- XSS vulnerability: malicious scripts could access keys
- User clearing browser = keys lost

### Server-Secure Mode
- Keys encrypted with AES-GCM at rest
- Only decrypted inside Supabase Edge Functions
- Row Level Security (RLS) prevents cross-user access
- Keys never touch browser after initial upload
- JWT tokens expire after 2 minutes

### General
- Dry-run mode is enabled by default for all trades
- Settings modal includes security warnings
- API keys should have "Trade" permission only (never Withdraw)
- Coinbase CDP keys use ES256 signing (2026 standard)

## Testing

Automated unit tests use **Vitest** for pure `src/lib/` modules (strategy engine, regime math, utils, assets, metalprice, kraken fee helpers).

```bash
npm test              # run once
npm run test:watch    # watch mode
npm run test:coverage # coverage gate: pure src/lib modules ≥ 70% statements
```

Coverage scope: `utils`, `regime`, `strategyEngine`, `krakenApi`, `metalprice`, `assets` (API client files excluded — see `vite.config.ts`).

CI (`.github/workflows/ci.yml`) runs lint, test, coverage, and build on every push and pull request to `main`. Merges are blocked when lint reports errors, tests fail, coverage drops below thresholds, or the build breaks. ESLint may emit warnings without failing CI — currently one known `react-hooks/exhaustive-deps` warning in `StrategyDashboard.tsx`.

On `main`, the same workflow uploads a `goldtrackr-dist` artifact and deploys via rsync over SSH (deploy key in `SSH_PRIVATE_KEY`; host/user/path in `SSH_HOST`, `SSH_USER`, `SSH_PATH`). Production builds use `base: './'` in `vite.config.ts` for subdirectory hosting — no post-build path rewrites.

Component and E2E tests are not yet in scope — manual verification still applies for UI:

- `npm run dev` for development testing
- `npm run preview` for production build verification
- Test trades should always use dry-run mode first

## Notes for Agents

- Always maintain the existing dark-first theming approach
- When adding new stores, use the persist middleware for data that should survive page reloads
- Mock data is provided for all API calls to ensure the app works without API keys
- Use the `vite/client` types for environment variable access (`import.meta.env.VITE_*`)
- The correlation matrix uses Pearson correlation on sparkline price data
- Trade suggestions calculate spreads between PAXG/XAUT and compare to spot gold
- When working with Supabase Edge Functions, use the `jose` library for JWT signing (already configured)
- Always handle both local and server-secure modes in trading-related components
- Always handle both Coinbase and Kraken exchanges where applicable
- The strategy engine is pure TypeScript with no React imports — keep it that way
- Coinbase balance sync integrates with the portfolio store via `syncCoinbaseBalances`
- RSS news fetching is disabled; `fetchGoldNews()` returns mock data
- All chart components use Recharts with `isAnimationActive={false}` for performance
- Respect the glass-morphism design system — use `.glass-card`, CSS variables, and consistent spacing
- Scenario & stress testing (Feature 3): **pure engine first** — new `createGoldExposureRebalancer` / `createHoldStrategy`, lightly extended `runBacktest(initialPositions?)`, pure shock helpers in strategyEngine.ts. StrategyDashboard hosts "Scenario Lab" internal mode (seed from portfolio, shocks, rebal + benchmarks, final gold oz, repeated NFA + "gross of fees" notes). Never mutate holdings; snapshots only. Matches "update pure engine first" rule.
- Regime / fidelity analysis: pure computations **must** live in `src/lib/regime.ts`. UI (scores, long matrix, rolling history, live deltas vs tactical corrs, strong NFA disclaimers) lives in `RegimeLens.tsx` (mounted from the "Fidelity & Regimes" tab in GoldComparisonTools). Spot gold long history is **always synthesized** — every label and interpretation box must surface "synthesized / estimated / model". CorrelationMatrix remains the short-term tactical view; the new tab provides the structural extension.
- When editing GoldComparisonTools, keep the 5-tab structure and ensure the lightweight fidelity callout in the overlay tab re-uses the already-fetched overlayData + pearsonCorrelation (no extra fetches).

## Cursor Cloud specific instructions

- Single Vite + React frontend; no backend service needs to run locally. Standard commands live in `package.json` / README (`npm run dev`, `npm run build`, `npm run lint`, `npm run preview`). Dependencies are refreshed by the startup update script (`npm ci`).
- No secrets/API keys are required: the app falls back to realistic mock data when `VITE_*` keys are absent (see `src/lib/api.ts`), so the dashboard, portfolio, correlations, and backtests are all fully usable for dev/testing without any `.env.local`.
- `npm run dev` serves on `http://localhost:5173/`. Vite is not bound with `--host` by default, so it only listens on localhost — pass `npm run dev -- --host` if you need to reach it from outside the VM.
- Validate changes via `npm run lint`, `npm test`, `npm run build`, and manual browser testing of the dev server. CI also runs `npm run test:coverage` with thresholds on pure `src/lib` modules.
- `npm run lint` currently emits one pre-existing `react-hooks/exhaustive-deps` warning in `StrategyDashboard.tsx` (0 errors) — that warning is expected, not something you introduced.
