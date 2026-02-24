# GoldTrackr — Agent Guide

This document provides essential information for AI coding agents working on the GoldTrackr project.

## Project Overview

GoldTrackr is a real-time gold and cryptocurrency dashboard that tracks PAXG, XAUT, BTC, and ETH prices. It provides correlation analysis, arbitrage alerts, trade suggestions, portfolio tracking, and gold-related news aggregation.

**Key Features:**
- Live price dashboard with 24h/7d changes and sparkline charts
- Correlation matrix across multiple time periods (1h/1d/7d/30d)
- Arbitrage alerts for PAXG/XAUT spread opportunities
- Portfolio tracker with unrealized P&L calculations
- Trade suggestions based on market conditions
- Gold news feed from Kitco RSS
- Dark/Light mode with localStorage persistence
- **Coinbase trading integration** with CDP API keys
- **Supabase backend** for secure key storage (optional)

## Technology Stack

| Category | Technology |
|----------|------------|
| Frontend Framework | React 19 (with StrictMode) |
| Language | TypeScript 5.9 |
| Build Tool | Vite 7 |
| Styling | TailwindCSS v4 with CSS custom properties |
| State Management | Zustand (with persist middleware) |
| Charts | Recharts |
| Backend (Optional) | Supabase (Auth + Postgres + Edge Functions + Multi-Exchange) |
| Linting | ESLint 9 with TypeScript, React Hooks, React Refresh |

## External APIs

| API | Purpose | Fallback |
|-----|---------|----------|
| CoinGecko | Crypto prices (PAXG, XAUT, BTC, ETH) | Mock data |
| MetalPrice | Spot gold prices | Mock data |
| Kitco RSS (via allorigins CORS proxy) | Gold-related news | Mock news |
| Coinbase (CDP) | Trading execution | N/A |

## Project Structure

```
goldtracker/
├── src/
│   ├── components/          # React components
│   │   ├── Dashboard.tsx           # Main price display grid
│   │   ├── PriceCard.tsx           # Individual crypto price card
│   │   ├── GoldSpotCard.tsx        # Spot gold price card
│   │   ├── CorrelationMatrix.tsx   # Price correlation visualization
│   │   ├── ArbitrageAlerts.tsx     # Arbitrage opportunity alerts
│   │   ├── PortfolioTracker.tsx    # Portfolio management UI
│   │   ├── TradeSuggestionsPanel.tsx # Trading recommendations + execution
│   │   ├── NewsFeed.tsx            # Kitco news display
│   │   ├── SettingsModal.tsx       # Trading settings + auth modal
│   │   └── DarkModeToggle.tsx      # Theme switcher
│   ├── hooks/               # Custom React hooks
│   │   ├── useGoldPrices.ts        # Price polling (60s interval)
│   │   ├── useTradeSuggestions.ts  # Trading signal generation
│   │   ├── useCorrelations.ts      # Correlation calculations
│   │   ├── useArbitrageAlerts.ts   # Arbitrage detection
│   │   └── useNews.ts              # News fetching
│   ├── store/               # Zustand state stores
│   │   ├── priceStore.ts           # Price data state
│   │   ├── themeStore.ts           # Dark/light mode (persisted)
│   │   ├── portfolioStore.ts       # Portfolio entries (persisted)
│   │   ├── settingsStore.ts        # Trading settings (persisted)
│   │   ├── alertStore.ts           # Alert notifications
│   │   └── useAuthStore.ts         # Supabase auth state
│   ├── services/            # API service layer
│   │   └── tradeService.ts         # Supabase Edge Function calls
│   ├── types/               # TypeScript definitions
│   │   ├── index.ts                # Core types (PriceData, GoldSpot, etc.)
│   │   └── TradeSuggestion.ts      # Trade suggestion types
│   ├── lib/                 # Utilities and API clients
│   │   ├── api.ts                  # API fetching functions
│   │   ├── utils.ts                # Formatting and math utilities
│   │   ├── supabase.ts             # Supabase client
│   │   └── coinbaseTrader.ts       # Client-side CDP JWT signing
│   ├── App.tsx              # Main application component
│   ├── main.tsx             # Entry point
│   └── index.css            # Global styles with CSS variables
├── supabase/                # Supabase backend
│   ├── functions/           # Edge Functions
│   │   ├── store-key/index.ts      # Encrypt & store CDP keys
│   │   ├── place-trade/index.ts    # Execute trades (jose library)
│   │   └── test-connection/index.ts # Test Coinbase connectivity
│   ├── schema.sql           # Database schema
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
  - `noFallthroughCasesInSwitch`: true
  - `noUncheckedSideEffectImports`: true

### Code Style

- Use functional components with hooks
- Prefer inline styles for component-specific styling using CSS variables
- Use Tailwind classes for common utilities (flex, grid, spacing, etc.)
- Import type-only imports with `import type { ... }`
- File extensions: `.tsx` for components, `.ts` for utilities

### CSS Variables (Theme System)

The project uses CSS custom properties for theming. Dark mode is default; `.light` class is applied to `:root` for light mode.

```css
/* Key variables available in all components */
--color-bg        /* Background color */
--color-surface   /* Card/surface background */
--color-surface2  /* Elevated surface */
--color-border    /* Border color */
--color-text      /* Primary text */
--color-muted     /* Secondary/muted text */
--color-gold      /* Gold accent (#f5c842) */
--color-green     /* Positive changes (#00d8a4) */
--color-red       /* Negative changes (#ff5e7d) */
--color-blue      /* Positive correlation */
--color-accent    /* Primary accent (#7c5cfc) */
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

### Data Refresh Intervals

- **Prices**: 60 seconds (`POLL_INTERVAL` in `useGoldPrices.ts`)
- **News**: 5 minutes
- **Arbitrage alerts**: Debounced to once per 5 minutes per pair

### API Key Configuration

Copy `.env.local.example` to `.env.local` and optionally add:

```bash
VITE_COINGECKO_API_KEY=your_key_here
VITE_METALPRICE_API_KEY=your_key_here
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

The app gracefully falls back to realistic mock data when API keys are not provided.

## Trading & Coinbase Integration

### Two Modes of Operation

| Feature | Local Mode | Server-Secure Mode |
|---------|-----------|-------------------|
| Key Storage | localStorage (Zustand persist) | AES-GCM encrypted in Supabase |
| Authentication | None required | Supabase Auth required |
| Trade Execution | Client-side JWT | Server-side Edge Function |
| Multi-device | ❌ | ✅ |
| Security Level | Good | Excellent |
| Setup | None | Supabase project required |

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

### Server-Side Trading (Supabase Mode)

Uses `src/services/tradeService.ts` → Supabase Edge Functions:
- Keys encrypted with AES-GCM before storage
- JWT signing happens in Edge Function using `jose` library
- Keys never touch browser after upload

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

## Utility Functions

Key utilities in `src/lib/utils.ts`:

- `formatPrice(price, decimals)` - Format as USD currency
- `formatPercent(pct, showSign)` - Format percentage with optional sign
- `formatNumber(n)` - Compact notation (K, M, B, T)
- `formatTimeAgo(isoString)` - Human-readable relative time
- `pearsonCorrelation(x, y)` - Calculate correlation coefficient
- `computeSpread(price1, price2)` - Calculate percentage spread
- `correlationColor(value)` - Get color for correlation value (-1 to +1)

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
