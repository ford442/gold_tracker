# Supabase Backend for GoldTrackr

This directory contains the Supabase backend configuration for secure storage and execution of Coinbase CDP API keys.

## Architecture

```
┌─────────────┐      HTTPS       ┌──────────────┐      ┌─────────────┐
│   Browser   │ ◄──────────────► │  Supabase    │ ◄───► │  Coinbase   │
│  (React)    │                  │ Edge Funcs   │       │    API      │
└─────────────┘                  └──────────────┘       └─────────────┘
       │                                │
       │    Store encrypted keys        │
       └────────────────────────────────┘
```

## Security Features

- **AES-GCM Encryption**: Keys are encrypted server-side before storage
- **Row Level Security (RLS)**: Users can only access their own keys
- **Edge Functions**: Decryption and API calls happen server-side
- **No keys in browser**: CDP private keys never touch the client after initial upload

## Setup Instructions

### 1. Create Supabase Project

1. Go to [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Create a new project (free tier works great)
3. Note your Project URL and Anon Key from Settings > API

### 2. Run Database Schema

1. Go to your Supabase project's SQL Editor
2. Copy the contents of `schema.sql` and run it

### 3. Set Environment Variables

In your Supabase Dashboard:
1. Go to Settings > Edge Functions
2. Add the following secrets:

```bash
ENCRYPTION_KEY=<generate with: openssl rand -base64 32>
```

### 4. Deploy Edge Functions

```bash
# Install Supabase CLI if not already installed
npm install -g supabase

# Login
supabase login

# Link to your project
supabase link --project-ref your-project-ref

# Deploy functions
supabase functions deploy store-key
supabase functions deploy place-trade
supabase functions deploy test-connection
supabase functions deploy fetch-news
supabase functions deploy coingecko-proxy
```

### 5. Configure Frontend

Copy `.env.local.example` to `.env.local` and fill in your Supabase credentials:

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

## Edge Functions

### `store-key`
Encrypts and stores Coinbase CDP keys in the database.

**POST** `/functions/v1/store-key`
```json
{
  "cdpKeyName": "organizations/xxx/apiKeys/xxx",
  "cdpPrivateKey": "-----BEGIN EC PRIVATE KEY-----\n..."
}
```

### `test-connection`
Tests if stored keys can connect to Coinbase API.

**POST** `/functions/v1/test-connection`

### `fetch-news`
Fetches gold-related RSS feeds server-side (Kitco + MINING.com), parses and caches results.

**GET/POST** `/functions/v1/fetch-news` (public — anon key only, no JWT required)

Response:
```json
{
  "items": [{ "id": "...", "title": "...", "url": "...", "source": "Kitco", "publishedAt": "...", "snippet": "..." }],
  "fetchedAt": "2025-07-21T10:00:00.000Z",
  "sources": ["Kitco", "MINING.com"],
  "cached": false
}
```

### `coingecko-proxy`<a id="coingecko-proxy"></a>
Cached, CORS-safe read-through proxy for the two CoinGecko endpoints the app uses. Keeps the API key off the client and shields CoinGecko's per-IP rate limit. Logic lives in `shared/coingeckoProxy.ts` (unit-tested); `index.ts` only does I/O.

**GET** `/functions/v1/coingecko-proxy/coins/markets?ids=…&sparkline=…&price_change_percentage=…`
**GET** `/functions/v1/coingecko-proxy/coins/{id}/market_chart?days=…&interval=…`

- Secret: `COINGECKO_API_KEY` (free CoinGecko demo key, optional but recommended): `supabase secrets set COINGECKO_API_KEY=…`
- Strict allowlist: only those two routes, `vs_currency=usd`, a fixed set of coin ids, bounded `days`/`interval`. Anything else is a `400`/`404` (so it can't be used as an open relay or to burn quota).
- Cache: markets 60 s, charts 5–30 min by horizon; concurrent identical requests share one upstream call; payloads that aren't valid CoinGecko JSON are never cached.
- Resilience: after an upstream `429` it leaves CoinGecko alone for `Retry-After` (5 s–5 min), and serves the last good copy (up to 24 h old) instead of an error when upstream is failing.
- Every response — including `4xx`/`5xx` — carries CORS headers, and exposes `Retry-After`, `X-GT-Cache` (`HIT`/`MISS`/`STALE`/`NONE`) and `X-GT-Proxy`.
- Per-IP limit: 600 requests/hour (in-memory, per Edge isolate).
- Adding a tracked asset: add its CoinGecko id to `ALLOWED_COIN_IDS` in `shared/coingeckoProxy.ts` (a test fails if `src/lib/assets.ts` and the list drift apart).
- The client sends the Supabase anon JWT only when the proxy is on the Supabase origin; it is never sent to a third-party `VITE_COINGECKO_PROXY_URL`.

### `place-trade`
Executes a trade using stored keys.

**POST** `/functions/v1/place-trade`
```json
{
  "product_id": "PAXG-USD",
  "side": "BUY",
  "order_configuration": {
    "market_market_ioc": {
      "base_size": "0.1"
    }
  }
}
```

## Client-Side vs Server-Side Keys

You have two options for storing Coinbase keys:

### Option 1: Client-Side (Default)
- Keys stored in browser localStorage (encrypted by Zustand)
- Fast, no backend required
- Good for personal use
- Risk: XSS attacks, browser clearing

### Option 2: Server-Side (Supabase)
- Keys encrypted and stored in Supabase Postgres
- More secure, multi-device support
- Requires Supabase backend setup
- Recommended for production

To use server-side storage, call the Edge Functions from your frontend after user authentication.

## Exchange registry sync

Venue metadata (supported pairs, Kraken native symbols, fees, `directPaxgXaut`, capabilities) has **one source of truth**:

| Artifact | Role |
|----------|------|
| [`shared/exchanges.json`](../shared/exchanges.json) | Canonical editable venue data |
| [`shared/registry.ts`](../shared/registry.ts) | Pure helpers (`supportsPair`, `resolveVenuePair`, fee math) |
| [`src/lib/exchanges.ts`](../src/lib/exchanges.ts) | Client facade (re-exports shared registry) |
| [`functions/_shared/registry.ts`](functions/_shared/registry.ts) | Edge Function re-export for Supabase deploy bundling |

**Do not** add local `PAIR_MAP` copies or hard-coded exchange allowlists in Edge Functions. Import from `../_shared/registry.ts` instead.

### Adding a new venue

1. Add an entry to [`shared/exchanges.json`](../shared/exchanges.json) (`supportedPairs`, `venuePairIds`, fees, flags, `keyFields`).
2. Implement the adapter in [`src/lib/exchangeAdapters.ts`](../src/lib/exchangeAdapters.ts).
3. Add auth/routing branches in `place-trade` and `test-connection` Edge Functions.
4. Run `npm test` — integrity tests in [`shared/registry.test.ts`](../shared/registry.test.ts) guard pair-map completeness and live-tradable venue sets.

Auto-deploying a new venue still requires manual adapter and Edge auth work; this registry only keeps metadata in sync between client and server.
