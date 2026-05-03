# GoldTrackr — Agent Guide

This document provides essential information for AI coding agents working on the GoldTrackr project.

## Project Overview

GoldTrackr is a real-time gold and cryptocurrency dashboard that tracks PAXG, XAUT, BTC, ETH, and BCH prices. It provides correlation analysis, arbitrage alerts, trade suggestions, portfolio tracking with Coinbase sync, algorithmic strategy backtesting, trade replay with projections, performance comparison, global arbitrage monitoring, and gold-related news aggregation.

**Key Features:**
- Live price dashboard with 24h/7d changes and sparkline charts
- Correlation matrix across multiple time periods (1h/1d/7d/30d)
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

## Project Structure

```
goldtracker/
├── src/
│   ├── components/          # React components
│   │   ├── Dashboard.tsx           # Main price display grid with countdown
│   │   ├── PriceCard.tsx           # Individual crypto price card
│   │   ├── GoldSpotCard.tsx        # Spot gold price card
│   │   ├── CorrelationMatrix.tsx   # Price correlation visualization
│   │   ├── ArbitrageAlerts.tsx     # Arbitrage opportunity alerts
│   │   ├── PortfolioTracker.tsx    # Portfolio management UI + Coinbase sync
│   │   ├── TradeSuggestionsPanel.tsx # Trading recommendations + execution
│   │   ├── NewsFeed.tsx            # News display (mock data)
│   │   ├── SettingsModal.tsx       # Trading settings + auth modal (accordion UI)
│   │   ├── DarkModeToggle.tsx      # Theme switcher
│   │   ├── StrategyDashboard.tsx   # Backtest configurator + equity curve + trade log
│   │   ├── GlobalArbitrageMonitor.tsx # Global arb monitor with synthetic signals
│   │   ├── TradeReplayChart.tsx    # Trade replay with projections and buy/sell markers
│   │   ├── PerformanceComparisonChart.tsx # 14-day normalized returns chart
│   │   ├── PnLOverTimeChart.tsx    # Portfolio P&L over time visualization
│   │   └── LoadingSkeleton.tsx     # Skeleton loading components (Skeleton, ChartSkeleton, TableSkeleton, CardSkeleton)
│   ├── hooks/               # Custom React hooks
│   │   ├── useGoldPrices.ts        # Price polling (60s interval)
│   │   ├── useTradeSuggestions.ts  # Trading signal generation
│   │   ├── useCorrelations.ts      # Correlation calculations
│   │   ├── useArbitrageAlerts.ts   # Arbitrage detection
│   │   ├── useNews.ts              # News fetching
│   │   └── useCoinbaseBalances.ts  # Coinbase account balance polling (60s)
│   ├── store/               # Zustand state stores
│   │   ├── priceStore.ts           # Price data state
│   │   ├── themeStore.ts           # Dark/light mode (persisted)
│   │   ├── portfolioStore.ts       # Portfolio entries with Coinbase sync (persisted)
│   │   ├── settingsStore.ts        # Trading settings + exchange selection (persisted)
│   │   ├── alertStore.ts           # Alert notifications
│   │   ├── strategyStore.ts        # Strategy backtest config + results (persisted)
│   │   └── useAuthStore.ts         # Supabase auth state
│   ├── services/            # API service layer
│   │   └── tradeService.ts         # Supabase Edge Function calls (store keys, test connection, execute trade)
│   ├── types/               # TypeScript definitions
│   │   ├── index.ts                # Core types (PriceData, GoldSpot, PortfolioEntry, AlertItem, NewsItem, ThemeMode, Chart types)
│   │   └── TradeSuggestion.ts      # Trade suggestion types
│   ├── lib/                 # Utilities and API clients
│   │   ├── api.ts                  # API fetching functions (CoinGecko, MetalPrice, mock data)
│   │   ├── utils.ts                # Formatting and math utilities
│   │   ├── supabase.ts             # Supabase client with graceful mock fallback
│   │   ├── coinbase.ts             # Coinbase CDP account fetching (getCoinbaseAccounts)
│   │   ├── coinbaseTrader.ts       # Client-side CDP JWT signing + order placement
│   │   ├── krakenApi.ts            # Kraken pair mapping and fee comparison utilities
│   │   └── strategyEngine.ts       # Pure TypeScript backtest engine (arbitrage + mean-reversion)
│   ├── App.tsx              # Main application component with keyboard shortcuts
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

**Backtest Runner** (`runBacktest`):
- Processes chronologically ordered price ticks
- Tracks equity curve, trade log, max drawdown
- Liquidates open positions at final tick prices
- Returns: `BacktestResult` with total return, win rate, equity curve, trades

### `StrategyDashboard` Component

- Strategy configurator with validation
- Mock tick generator (720 ticks = 30 days of hourly data)
- Equity curve area chart
- Trade log table (last 100 executions)
- Performance stat boxes (final balance, return, max drawdown, win rate, trades)

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

This project does not currently have automated tests. Testing is done manually through:
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
